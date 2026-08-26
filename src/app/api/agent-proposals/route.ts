import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { homedir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);
const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;

function shJson<T = any>(sql: string): Promise<T[]> {
  // -json makes sqlite3 emit one JSON array — no pipe/newline parsing issues
  return execFileP("sqlite3", ["-json", KANBAN_DB, sql], { timeout: 5000, maxBuffer: 1024 * 1024 })
    .then((r) => (r.stdout.trim() ? JSON.parse(r.stdout.trim()) : []))
    .catch(() => []);
}

const COMMENT_SQL = `
  SELECT c.id, c.task_id, c.author, c.body, c.created_at, t.title AS task_title, t.status AS task_status
  FROM task_comments c
  JOIN tasks t ON t.id = c.task_id
  WHERE c.author IN ('nova','sage','knox','max','pixel')
    AND length(c.body) > 100
  ORDER BY c.created_at DESC;`;

// Agents report results in task_runs.summary (not task_comments). Surface a
// run as a proposal when the task asked for ideas/recommendations (reviews,
// UX proposals, audits) — routine reports stay off the proposal board.
const RUN_SQL = `
  SELECT 'run-' || r.id AS id, r.task_id,
         CASE WHEN r.profile = 'default' THEN 'max' ELSE r.profile END AS author,
         r.summary AS body,
         coalesce(r.ended_at, r.started_at) AS created_at,
         t.title AS task_title, t.status AS task_status
  FROM task_runs r
  JOIN tasks t ON t.id = r.task_id
  WHERE r.status = 'done'
    AND length(coalesce(r.summary,'')) > 100
    AND r.id = (SELECT MAX(r2.id) FROM task_runs r2 WHERE r2.task_id = r.task_id)
    AND (
      lower(t.title) LIKE '%propos%' OR lower(t.title) LIKE '%sugges%'
      OR lower(t.title) LIKE '%recommend%' OR lower(t.title) LIKE '%improv%'
      OR lower(t.title) LIKE '%review%' OR lower(t.title) LIKE '%ux%'
      OR lower(coalesce(t.body,'')) LIKE '%propose%' OR lower(coalesce(t.body,'')) LIKE '%suggest%'
      OR lower(coalesce(t.body,'')) LIKE '%recommend%' OR lower(coalesce(t.body,'')) LIKE '%improvement%'
    )
  ORDER BY created_at DESC;`;

const BOARD_NAME = process.env.HERMES_BOARD || "default";

function epochToIso(v: unknown): string {
  // sqlite epochs are seconds; guard against null/garbage so a bad row can
  // never crash serialization again (RangeError: Invalid time value)
  const n = Number(v);
  const secs = Number.isFinite(n) && n > 0 ? n : Math.floor(Date.now() / 1000);
  return new Date(secs * 1000).toISOString();
}

function firstLine(body: string): string {
  const flat = body.replace(/\n+/g, " ").trim();
  return (flat.split(/\.(?=\s)/)[0] || flat).trim();
}

function toProposal(row: any, persisted?: any, followUp?: { status: string; result: string | null; blockKind?: string | null } | null) {
  const createdAt = epochToIso(row.created_at);
  return {
    id: String(row.id),
    taskId: row.task_id,
    agent: row.author,
    title: persisted?.title || `${row.author}: ${firstLine(row.body).slice(0, 70)}`,
    body: row.body,
    createdAt,
    reviewedAt: persisted?.reviewedAt?.toISOString?.() || null,
    status: persisted?.status || "pending",
    taskTitle: row.task_title,
    taskStatus: row.task_status,
    followUpTaskId: persisted?.followUpTaskId || null,
    followUpStatus: followUp?.status || null,
    followUpResult: followUp?.result || null,
    followUpBlockKind: followUp?.blockKind || null,
  };
}

export async function GET() {
  try {
    const [persisted, commentRows, runRows] = await Promise.all([
      prisma.agentProposal.findMany(),
      shJson(COMMENT_SQL),
      shJson(RUN_SQL),
    ]);

    // Merge: comments first (explicit proposals), then run summaries, deduped
    // by taskId (a task contributes at most one proposal — newest wins).
    const byTask = new Map<string, any>();
    for (const row of [...commentRows, ...runRows]) {
      const prev = byTask.get(row.task_id);
      if (!prev || Number(row.created_at) > Number(prev.created_at)) byTask.set(row.task_id, row);
    }
    const rows = [...byTask.values()];

    const stateByTask = new Map(persisted.map((p) => [p.taskId, p]));

    // Self-heal: proposals turned into tasks get their follow-up kanban id
    // backfilled from the bridge's AgentRequest result (task JSON from
    // `hermes kanban create --json`).
    const unlinked = persisted.filter(
      (p) => p.status === "turned-into-task" && !p.followUpTaskId
    );
    if (unlinked.length) {
      for (const p of unlinked.slice(0, 10)) {
        const req = await prisma.agentRequest.findFirst({
          where: { hermesTaskId: p.taskId, kind: "kanban", status: "done" },
          orderBy: { createdAt: "desc" },
        });
        if (!req?.result) continue;
        // Result is pretty-printed JSON, possibly truncated at 8000 chars —
        // regex the id out instead of JSON.parse.
        const m = /"id"\s*:\s*"(t_[a-z0-9]+)"/.exec(req.result);
        const newId = m?.[1];
        if (newId) {
          await prisma.agentProposal.update({
            where: { taskId: p.taskId },
            data: { followUpTaskId: newId },
          });
          p.followUpTaskId = newId;
        }
      }
    }

    // Live status of follow-up tasks created from proposals (single sqlite query)
    const followUpIds = persisted
      .map((p) => p.followUpTaskId)   // includes ids just backfilled above
      .filter((id): id is string => Boolean(id));
    const followUpMap = new Map<string, { status: string; result: string | null; blockKind?: string | null }>();
    if (followUpIds.length) {
      const list = followUpIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",");
      const liveRows = await shJson(
        `SELECT id, status, result, block_kind FROM tasks WHERE id IN (${list});`
      );
      for (const r of liveRows) {
        followUpMap.set(String(r.id), { status: String(r.status), result: r.result ?? null, blockKind: r.block_kind ?? null });
      }
    }

    const proposals = rows.map((row: any) => {
      const p = stateByTask.get(row.task_id);
      return toProposal(row, p, p?.followUpTaskId ? followUpMap.get(p.followUpTaskId) : null);
    });

    // Not everything an agent reports is a proposal. Filter out pure status
    // notifications — reports whose summary says there's nothing to decide
    // (duplicate work / already implemented / no remaining action). These are
    // completion notes, not calls for the user's approval.
    const NOT_A_PROPOSAL =
      /\b(already (implemented|completed|shipped|done)|duplicate of|no remaining work|nothing to (do|decide)|no further action)\b/i;
    const actionable = proposals.filter((p: any) => {
      if (p.status !== "pending") return true;           // reviewed items stay visible
      if (p.taskStatus === "done" && NOT_A_PROPOSAL.test(p.body || "")) return false;
      return true;
    });

    actionable.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(actionable, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Agent proposals API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, proposalId, taskId, message } = await request.json();

    if (!action || (action !== "unblock" && !proposalId)) {
      return NextResponse.json({ error: "action and proposalId required" }, { status: 400 });
    }

    // Worker blocked with needs_input — post Dipta's guidance as a task comment
    // and unblock so the worker resumes with the answer in context. Keys on
    // taskId, not proposalId, so it runs before the proposal lookup.
    if (action === "unblock") {
      if (!taskId || typeof taskId !== "string" || !message?.trim()) {
        return NextResponse.json({ error: "Missing taskId or message" }, { status: 400 });
      }
      const safeId = taskId.replace(/[^a-z0-9_]/gi, "");
      const { execFile } = await import("child_process");
      const run = (args: string[]) =>
        new Promise<void>((resolve, reject) => {
          execFile(
            `${process.env.HOME}/.local/bin/hermes`,
            args,
            { timeout: 20_000 },
            (err) => (err ? reject(err) : resolve()),
          );
        });
      await run(["kanban", "--board", BOARD_NAME, "comment", safeId, `[Guidance from Dipta] ${message.trim()}`]);
      await run(["kanban", "--board", BOARD_NAME, "unblock", "--reason", "Operator answered needs_input via dashboard", safeId]);
      // Unblock lands the task in 'todo' (triage) which the dispatcher ignores —
      // promote to 'ready' so the worker picks it up immediately.
      const { execSync } = await import("child_process");
      execSync(
        `sqlite3 "$HOME/.hermes/kanban.db" "UPDATE tasks SET status='ready' WHERE id='${safeId}'"`,
        { timeout: 5_000 },
      );
      // kanban unblock resets the assignee to 'default' — restore the owning
      // profile so the right worker claims it (default = max, not nova/knox/etc).
      const prop = await prisma.agentProposal.findUnique({ where: { taskId } });
      if (prop && prop.agent !== "max") {
        await run(["kanban", "--board", BOARD_NAME, "reassign", safeId, prop.agent]).catch(() => {});
      }
      await prisma.agentProposal.update({
        where: { taskId },
        data: { status: "turned-into-task", reviewedAt: new Date() },
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // Find the proposal — create the Postgres row on demand if missing.
    // Proposals come from two sources: kanban task_comments (id = comment id)
    // and task_runs summaries (id = "run-<n>"). Look in Postgres first, then
    // fall back to whichever source matches the id shape.
    let proposal = await prisma.agentProposal.findUnique({ where: { taskId: proposalId } });
    if (!proposal) {
      const isRunId = proposalId.startsWith("run-");
      const runNum = isRunId ? proposalId.slice(4).replace(/[^0-9]/g, "") : "";
      // Try, in order: run by run-id, comment by task_id, run by task_id.
      // (The UI may send any of: proposal id "run-<n>", or the source task id.)
      const attempts = isRunId
        ? [RUN_SQL.replace("ORDER BY created_at DESC;", ` AND r.id = '${runNum}';`)]
        : [
            COMMENT_SQL.replace("ORDER BY c.created_at DESC;", `AND c.task_id = '${proposalId.replace(/'/g, "")}';`),
            RUN_SQL.replace("ORDER BY created_at DESC;", ` AND r.task_id = '${proposalId.replace(/'/g, "")}';`),
          ];
      let rows: any[] = [];
      for (const sql of attempts) {
        rows = await shJson(sql);
        if (rows.length) break;
      }
      if (!rows.length) {
        return NextResponse.json({ error: "proposal not found" }, { status: 404 });
      }
      const row = rows[0];
      proposal = await prisma.agentProposal.create({
        data: {
          id: String(row.id),
          taskId: row.task_id,
          agent: row.author,
          title: `${row.author}: ${firstLine(row.body).slice(0, 70)}`,
          body: row.body,
          createdAt: epochToIso(row.created_at) as unknown as Date,
          status: "pending",
        },
      });
    }

    if (action === "approve" || action === "reject") {
      const status = action === "approve" ? "approved" : "rejected";
      const updated = await prisma.agentProposal.update({
        where: { taskId: proposalId },
        data: { status, reviewedAt: new Date() },
      });
      return NextResponse.json({ ok: true, proposal: updated });
    }

    if (action === "createTask") {
      const strippedTitle = proposal.title.replace(/^[a-z]+:\s*/, "").trim();
      // "[agent]" prefix tells the bridge which profile to assign the task to.
      // NB: Max's cast id is "max" but his real Hermes profile is "default" —
      // route to the actual profile so the dispatcher can claim the task.
      const profileId = proposal.agent === "max" ? "default" : proposal.agent;
      const routedTitle = `[${profileId}] Implement: ${strippedTitle}`;
      const pr = await prisma.agentProposal.update({
        where: { taskId: proposalId },
        data: { status: "turned-into-task", reviewedAt: new Date() },
      });

      await prisma.agentRequest.create({
        data: {
          origin: "web",
          kind: "kanban",
          title: routedTitle,
          prompt: proposal.body,
          sideEffecting: true,
          status: "approved",
          hermesTaskId: proposalId,
        },
      });

      // Recover the follow-up kanban task id on later GETs: the bridge stores
      // the create output (task JSON) in AgentRequest.result when done.
      return NextResponse.json({ ok: true, proposal: pr, taskTitle: routedTitle });
    }


    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Agent proposals action error:", error);
    return NextResponse.json({ error: "action failed", detail: String(error) }, { status: 500 });
  }
}
