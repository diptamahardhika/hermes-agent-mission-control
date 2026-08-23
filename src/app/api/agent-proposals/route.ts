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
  SELECT 'run-' || r.id AS id, r.task_id, r.profile AS author, r.summary AS body,
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

function toProposal(row: any, persisted?: any, followUp?: { status: string; result: string | null } | null) {
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
    const followUpMap = new Map<string, { status: string; result: string | null }>();
    if (followUpIds.length) {
      const list = followUpIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",");
      const liveRows = await shJson(
        `SELECT id, status, result FROM tasks WHERE id IN (${list});`
      );
      for (const r of liveRows) {
        followUpMap.set(String(r.id), { status: String(r.status), result: r.result ?? null });
      }
    }

    const proposals = rows.map((row: any) => {
      const p = stateByTask.get(row.task_id);
      return toProposal(row, p, p?.followUpTaskId ? followUpMap.get(p.followUpTaskId) : null);
    });

    proposals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(proposals, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Agent proposals API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, proposalId } = await request.json();

    if (!action || !proposalId) {
      return NextResponse.json({ error: "action and proposalId required" }, { status: 400 });
    }

    // Find the proposal — create the Postgres row on demand if missing
    let proposal = await prisma.agentProposal.findUnique({ where: { taskId: proposalId } });
    if (!proposal) {
      const rows = await shJson(COMMENT_SQL.replace("ORDER BY c.created_at DESC;", `AND c.task_id = '${proposalId.replace(/'/g, "")}';`));
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
          createdAt: new Date(row.created_at * 1000),
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
      // "[agent]" prefix tells the bridge which profile to assign the task to
      const routedTitle = `[${proposal.agent}] Implement: ${strippedTitle}`;
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
