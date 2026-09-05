#!/usr/bin/env node
/**
 * Hermy HQ ↔ Hermes bridge.
 *
 * Runs on the Mac mini where Hermes lives. Talks to the shared Postgres
 * (the same DATABASE_URL the website uses) — nothing is exposed to the
 * internet. Two jobs:
 *
 *   PULL  (Hermes → website): mirror the kanban board into HermesTask,
 *         cron list + health into DataStore, and emit activity events.
 *   PUSH  (website → Hermes): pick up AgentRequest rows that are `queued`
 *         (safe) or `approved` (human-approved side-effecting), run them
 *         through the `hermes` CLI, and write results back.
 *
 * Requires: the `hermes` binary on PATH, and env DATABASE_URL.
 * Optional env: HERMES_BOARD (default "default"), BRIDGE_POLL_MS (5000),
 *               BRIDGE_MIRROR_MS (30000), HERMES_BIN (default "hermes").
 */
import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.existsSync(path.join(__dirname, ".env")) ? fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n") : []) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || m[1] in process.env) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

const execFileP = promisify(execFile);
const HERMES = process.env.HERMES_BIN || "hermes";
const HOST = os.hostname();
const BOARD = process.env.HERMES_BOARD || "default";
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 5000);
const MIRROR_MS = Number(process.env.BRIDGE_MIRROR_MS || 30000);
// NB: briefs routinely run 4-8 min (worse when the credential pool is dry and
// Hermes falls back to a free model). The original 240s default killed every
// long brief with a bare "Command failed" — raise it and override via env.
const RUN_TIMEOUT_MS = Number(process.env.BRIDGE_RUN_TIMEOUT_MS || 600000);
const HOMELAB_URL = process.env.HOMELAB_MONITOR_URL || "";
const HOMELAB_TOKEN = process.env.HOMELAB_MONITOR_TOKEN || "";
const WIKI_DIR = process.env.HERMES_WIKI || path.join(os.homedir(), ".hermes", "wiki");
const BRIEFS_DIR = process.env.HERMES_BRIEFS_DIR || path.join(os.homedir(), ".hermes", "briefs");
// NB: a function, not a const — the timestamp must be computed per run.
// As a const it froze at process start and every brief greeted with the
// bridge's boot time ("Good evening …" at 9am, every single run).
function briefPrompt() {
  return "You are the operator's chief of staff. Produce today's brief. Read your memory wiki open-loops " +
    "(~/.hermes/wiki), the kanban board, and recent activity. Output ONLY valid JSON (no prose, no code fences) " +
    'in exactly this shape: {"greeting":"one warm line","summary":"2-3 sentences on where things stand",' +
    '"sections":[{"label":"Needs your decision","items":["..."]},{"label":"Top priorities","items":["..."]},' +
    '{"label":"Recently shipped","items":["..."]},{"label":"Next actions","items":["..."]}]}. ' +
    "Keep every item short, concrete, and specific. " +
    "Always include all four sections in this exact order — use an empty items array for a section with nothing. " +
    `The current date and time is ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} (operator's local time). ` +
    "Use this to greet with the correct time of day (good morning / good afternoon / good evening) and to describe recent activity accurately.";
}

const DB_URL = process.env.DATABASE_URL || "";
if (!DB_URL) { console.error("DATABASE_URL is required (use the direct postgres:// URL, not a prisma:// Accelerate URL)"); process.exit(1); }
if (DB_URL.startsWith("prisma://") || DB_URL.startsWith("prisma+")) {
  console.error("DATABASE_URL is a Prisma Accelerate URL; the bridge needs a DIRECT postgres:// connection string (e.g. POSTGRES_URL).");
  process.exit(1);
}
// Cloud Postgres (Prisma Postgres/Neon/Supabase/RDS) needs SSL; localhost doesn't.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(DB_URL);
const pool = new pg.Pool({ connectionString: DB_URL, max: 4, ssl: isLocal ? undefined : { rejectUnauthorized: false } });

const log = (...a) => console.log(new Date().toISOString(), ...a);
const q = (text, params) => pool.query(text, params);

// ── Self-healing: stale kanban.lock recovery ─────────────────────────
// Hermes's SQLite-backed kanban can be left with a stale 0-byte init/dispatch
// lock when the gateway or CLI is killed uncleanly (e.g. power loss, OOM).
// The lock file is created with a touch() and never properly cleaned up,
// so after the process dies the file persists — any subsequent `hermes kanban`
// invocation hits "Operation not permitted" trying to initialise the DB.
//
// WORKAROUND: If the original ~/.hermes/kanban.db has unremovable locks
// (e.g. macOS ACL deny-delete on parent dir), copy the DB to /tmp and use
// HERMES_KANBAN_DB to point Hermes at the copy. The copy is refreshed on
// each mirror tick so it stays reasonably current.
const HERMES_HOME = path.join(os.homedir(), ".hermes");
const TEMP_KANBAN_DB = "/tmp/hermes-db/kanban.db";
function ensureTempKanbanDb() {
  try {
    fs.mkdirSync(path.dirname(TEMP_KANBAN_DB), { recursive: true });
    const src = path.join(HERMES_HOME, "kanban.db");
    const dst = TEMP_KANBAN_DB;
    // Always copy to pick up latest WAL state
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      // Remove any lock files from the copy
      for (const lockName of ["kanban.db.init.lock", "kanban.db.dispatch.lock"]) {
        try { fs.unlinkSync(path.join(path.dirname(dst), lockName)); } catch {}
      }
    }
    return TEMP_KANBAN_DB;
  } catch (e) {
    log(`ensureTempKanbanDb failed: ${e.message}`);
    return null;
  }
}
// We check each lock's age: only remove it if it's genuinely stale
// (older than 5 minutes). A real init/dispatch transaction completes in
// milliseconds; if a lock persists beyond 5 minutes, nothing is running
// and it's safe to remove. The previous 10-second threshold caused an
// infinite clean-loop because Hermes recreates locks within ~12 seconds
// of deletion, so the lock was always "stale" by the time we checked it.
const STALE_LOCK_AGE_MS = 300_000; // 5 minutes
function cleanStaleLocks() {
  for (const lockName of ["kanban.db.init.lock", "kanban.db.dispatch.lock"]) {
    const lockPath = path.join(HERMES_HOME, lockName);
    try {
      if (!fs.existsSync(lockPath)) continue;
      const { mtimeMs } = fs.statSync(lockPath);
      const age = Date.now() - (mtimeMs || 0);
      if (age < STALE_LOCK_AGE_MS) continue; // not stale enough
      try {
        fs.unlinkSync(lockPath);
        log(`self-heal: removed stale ${lockName} (age=${Math.round(age / 1000)}s)`);
      } catch (e) {
        // Silently ignore permission errors (e.g., macOS ACL deny-delete on parent dir)
      }
    } catch (e) { /* never fatal — next mirror tick will retry */ }
  }
}

// ── Self-healing: dispatch stuck kanban tasks when gateway is down ──────────
// When the gateway crashes or restarts, its embedded dispatcher stops running.
// Kanban tasks created during that window sit in `ready` indefinitely because
// no dispatcher is polling to claim them. This function detects that condition
// and manually triggers a dispatch pass to unstick them.
const STUCK_KANBAN_MINUTES = 10;
async function healStuckKanban() {
  try {
    // Check gateway status
    const statusOut = await hermes(["status"], { timeout: 10000 });
    const gatewayDown = !/Gateway Service\s*\n[\s\S]*?Status:\s*[✓\s]*running/i.test(statusOut);
    if (gatewayDown) {
      // Gateway is down — try to dispatch any stuck ready tasks
      const ageThreshold = Date.now() - STUCK_KANBAN_MINUTES * 60 * 1000;
      const out = await hermes(["kanban", "--board", BOARD, "list", "--json"], { timeout: 15000 });
      const tasks = JSON.parse(out || "[]");
      const stuck = tasks.filter((t) => t.status === "ready" && t.created_at && t.created_at * 1000 < ageThreshold);
      if (stuck.length > 0) {
        log(`self-heal: gateway down, ${stuck.length} stuck task(s) — dispatching`);
        try {
          await hermes(["kanban", "--board", BOARD, "dispatch", "--json"], { timeout: 30000 });
        } catch (e) {
          log(`self-heal: dispatch failed: ${e.message.split("\n")[0]}`);
        }
      }
    }
  } catch (e) {
    // Non-fatal — next mirror tick will retry
    log(`healStuckKanban check failed: ${e.message.split("\n")[0]}`);
  }
}

// The hermes CLI owns a single session slot; concurrent invocations fight over
// it and fail ("Command failed: hermes ..."). Serialize every call through a
// chain so mirrors + queue runs never overlap.
let hermesChain = Promise.resolve();
function hermes(args, { timeout = 30000, env = null } = {}) {
  const run = hermesChain.then(async () => {
    const { stdout } = await execFileP(HERMES, args, { timeout, maxBuffer: 8 * 1024 * 1024, env });
    return stdout;
  });
  hermesChain = run.catch(() => {});
  return run;
}

function parseTaskResult(result) {
  try {
    const json = JSON.parse(result);
    // Hermes CLI kanban create --json returns task info; be lenient with format
    if (json && (json.id || json.taskId)) {
      return { id: json.id || json.taskId, title: json.title || json.name || json.id, data: json };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function linkDecisionToHermesTask(decisionKey, hermesTaskId) {
  try {
    await q(
      `UPDATE "Decision" SET hermesTaskId = $1, updatedAt = now()
       WHERE key = $2`,
      [hermesTaskId, decisionKey]
    );
    log(`linked decision ${decisionKey} → Hermes task ${hermesTaskId}`);
  } catch (e) {
    log(`failed to link decision ${decisionKey} to Hermes task ${hermesTaskId}:`, e.message);
  }
}

async function emit(kind, title, { detail = null, agent = "hermes", level = "info", meta = null } = {}) {
  await q(
    `INSERT INTO "AgentEvent" (id, kind, title, detail, agent, level, meta, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
    [randomUUID(), kind, title.slice(0, 200), detail, agent, level, meta ? JSON.stringify(meta) : null]
  );
}

async function setStore(key, data) {
  await q(
    `INSERT INTO "DataStore" (key, data, "updatedAt") VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = now()`,
    [key, JSON.stringify(data)]
  );
}

/* ─────────────── PULL: mirror Hermes → Postgres ─────────────── */
async function mirrorKanban() {
  // Clean up stale kanban lock files before attempting to run hermes kanban
  cleanStaleLocks();

  // Try to use temp DB copy if original has unremovable locks
  let hermesEnv = { ...process.env };
  const kanbanDbPath = ensureTempKanbanDb();
  if (kanbanDbPath) {
    hermesEnv.HERMES_KANBAN_DB = kanbanDbPath;
  }

  let tasks = [];
  try {
    // NB: this Hermes CLI wants --board BEFORE the subcommand.
    const out = await hermes(["kanban", "--board", BOARD, "list", "--json"], {
      timeout: 15000,
      env: hermesEnv,
    });
    const parsed = JSON.parse(out || "[]");
    tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch (e) { log("kanban list failed:", e.message.split("\n")[0]); return; }

  // tasks.result is often null (agents write files instead of returning text);
  // the human-readable summary lives in the latest task_runs row of the LOCAL
  // sqlite kanban.db (not Postgres). Read it with sqlite3.
  let runSummaries = {};
  try {
    const kanbanDb = path.join(os.homedir(), ".hermes", "kanban.db");
    if (fs.existsSync(kanbanDb)) {
      const { stdout } = await execFileP("sqlite3", [
        kanbanDb,
        `SELECT task_id, summary FROM task_runs r
         WHERE summary IS NOT NULL AND summary <> ''
         AND id = (SELECT max(id) FROM task_runs r2 WHERE r2.task_id = r.task_id AND r2.summary IS NOT NULL AND r2.summary <> '');`,
      ], { timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
      for (const line of stdout.trim().split("\n")) {
        if (!line) continue;
        const sep = line.indexOf("|");
        if (sep > 0) runSummaries[line.slice(0, sep)] = line.slice(sep + 1);
      }
    }
  } catch (e) { log("task_runs join failed:", e.message.split("\n")[0]); }

  const seen = new Set();
  for (const t of tasks) {
    const id = String(t.id ?? t.task_id ?? "");
    if (!id) continue;
    seen.add(id);
    const result = (t.result || runSummaries[id] || null);
    await q(
      `INSERT INTO "HermesTask" (id, board, title, assignee, status, priority, result, "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, assignee=EXCLUDED.assignee, status=EXCLUDED.status,
         priority=EXCLUDED.priority, result=EXCLUDED.result, "syncedAt"=now()`,
      [id, BOARD, String(t.title ?? "untitled").slice(0, 300), t.assignee ?? null,
       String(t.status ?? "todo"), t.priority != null ? Number(t.priority) : null,
       result ? String(result).slice(0, 2000) : null]
    );
  }
  // prune tasks that vanished from the board
  if (seen.size) {
    await q(`DELETE FROM "HermesTask" WHERE board=$1 AND id <> ALL($2::text[])`, [BOARD, [...seen]]);
  } else {
    await q(`DELETE FROM "HermesTask" WHERE board=$1`, [BOARD]);
  }
}

async function mirrorCrons() {
  cleanStaleLocks();
  try {
    const out = await hermes(["cron", "list", "--all"], { timeout: 15000 });
    const lines = out.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    await setStore("hermes-crons", { jobs: lines, raw: out.slice(0, 8000), syncedAt: new Date().toISOString() });
    return out;
  } catch (e) { log("cron list failed:", e.message.split("\n")[0]); return null; }
}

/* ─────────────── self-healing: cron drift_skip auto-pin ─────────────── */
// Hermes refuses to run unpinned cron jobs after the global inference config
// drifts ([drift_skip] guard) to prevent unintended spend. No inference is
// made while skipped, and the skip message itself names the new config
// ("model 'old' -> 'new'") — so pinning the job to the named config is safe
// and exactly what the operator would do by hand. Runs on every mirror tick
// using the cron-list output we already fetched.
const driftHealedAt = new Map(); // jobId -> last heal ts; retry at most hourly
// Read Hermes's live inference routing — the drift message names a MODEL, but
// that model usually runs through a routed provider (e.g. nous omniroute),
// NOT the native vendor in the model name ("upstage/..." ≠ provider upstage).
// Guessing provider from the model prefix produces [blocked_config]
// credential errors; asking config show gives the provider that actually works.
let cachedInfCfg = { at: 0, provider: null };
async function currentInferenceProvider() {
  if (Date.now() - cachedInfCfg.at < 300_000) return cachedInfCfg.provider;
  try {
    const out = await hermes(["config", "show"], { timeout: 20000 });
    const line = out.split("\n").find((l) => /Model:\s*\{/.test(l)) ?? "";
    cachedInfCfg = { at: Date.now(), provider: line.match(/'provider':\s*'([^']+)'/)?.[1] ?? null };
  } catch { /* keep previous cache */ }
  return cachedInfCfg.provider;
}
async function healCronDrift(cronListOutput) {
  if (!cronListOutput) return;
  // Each job block starts with "  <12-hex id> [active|paused]".
  const blocks = cronListOutput.split(/(?=^  [0-9a-f]{12} \[)/m);
  for (const block of blocks) {
    const id = block.match(/^  ([0-9a-f]{12}) \[active\]/m)?.[1];
    if (!id) continue;
    if (!block.includes("[drift_skip]") || !block.includes("this job is unpinned")) continue;
    const drift = block.match(/model '([^']+)' -> '([^']+)'/);
    if (!drift) { log(`drift_skip on ${id} but no target model in message — leaving for manual fix`); continue; }
    // Cooldown: at most one heal attempt per job per hour to avoid thrashing.
    if (Date.now() - (driftHealedAt.get(id) ?? 0) < 3600_000) continue; // one heal per hour max
    driftHealedAt.set(id, Date.now());
    const model = drift[2];
    const provider = (await currentInferenceProvider()) ?? (model.includes("/") ? model.split("/")[0] : null); // pin to current live config
    const args = ["cron", "edit", id, "--model", model];
    if (provider) args.push("--provider", provider);
    try {
      await hermes(args, { timeout: 20000 }); // pin exact working config (avoid re-resolving)
      log(`self-healed drift_skip: ${id} pinned to ${provider ?? "(default)"}/${model}`);
      await emit("status", `Self-healed cron drift: ${id} pinned to ${model}`, {
        detail: `Job was skipped by drift_skip guard; pinned provider=${provider ?? "default"} model=${model}.`,
        level: "up",
        meta: { jobId: id, model, provider },
      });
    } catch (e) {
      log(`drift heal failed for ${id}:`, e.message?.split("\n")[0]);
      driftHealedAt.delete(id); // allow retry next tick
    }
  }
}

// Parse the fixed-text output of `hermes insights` into structured usage data.
// The CLI has no --json flag (verified), so this regexes the Overview block and
// the Models/Platforms/Tools/Skills tables. Returns nulls for anything not
// found — never guesses.
export function parseInsights(text) {
  const num = (s) => Number(String(s).replace(/,/g, ""));
  const grab = (re) => { const m = text.match(re); return m ? num(m[1]) : null; };
  // Body of a "  <emoji> <Name>" section: everything up to the next blank line.
  const section = (name) => {
    const i = text.indexOf(name);
    if (i === -1) return "";
    const rest = text.slice(i);
    const afterHead = rest.indexOf("\n");
    if (afterHead === -1) return "";
    const body = rest.slice(afterHead + 1);
    const end = body.indexOf("\n\n");
    return end === -1 ? body : body.slice(0, end);
  };
  const data = {
    sessions: grab(/Sessions:\s*([\d,]+)/),
    messages: grab(/Messages:\s*([\d,]+)/),
    toolCalls: grab(/Tool calls:\s*([\d,]+)/),
    inputTokens: grab(/Input tokens:\s*([\d,]+)/),
    outputTokens: grab(/Output tokens:\s*([\d,]+)/),
    totalTokens: grab(/Total tokens:\s*([\d,]+)/),
    userMessages: grab(/User messages:\s*([\d,]+)/),
    activeTime: text.match(/Active time:\s*(~?\S+)/)?.[1] ?? null,
    avgSession: text.match(/Avg session:\s*(~?[^\n]+?)\s*$/m)?.[1]?.trim() ?? null,
    avgMsgsPerSession: grab(/Avg msgs\/session:\s*([\d.]+)/),
    period: text.match(/Period:\s*([^\n]+?)(?:\s{2,}|$)/m)?.[1]?.trim() ?? null,
    unknownSessions: grab(/Unknown:\s*([\d,]+) session/),
    byModel: [],
    platforms: [],
    tools: [],
    skills: [],
  };
  for (const line of section("Models Used").split("\n")) {
    // e.g. "  solar-pro4:free     129   136,714,672"
    const m = line.match(/^\s{2}(\S.*?)\s{2,}(\d+)\s+([\d,]+)\s*$/);
    if (m) data.byModel.push({ model: m[1].trim(), sessions: num(m[2]), tokens: num(m[3]) });
  }
  for (const line of section("Platforms").split("\n")) {
    // e.g. "  cli                 204      1,838     31,562,108"
    const m = line.match(/^\s{2}(\S.*?)\s{2,}([\d,]+)\s{2,}([\d,]+)\s{2,}([\d,]+)\s*$/);
    if (m) data.platforms.push({ name: m[1].trim(), sessions: num(m[2]), messages: num(m[3]), tokens: num(m[4]) });
  }
  const toolsSection = section("Top Tools");
  for (const line of toolsSection.split("\n")) {
    // e.g. "  terminal                        4,190    64.6%"
    const m = line.match(/^\s{2}(\S.*?)\s{2,}([\d,]+)\s+([\d.]+)%\s*$/);
    if (m) data.tools.push({ name: m[1].trim(), calls: num(m[2]), pct: Number(m[3]) });
  }
  const more = toolsSection.match(/\.\.\.\s*and (\d+) more tools/);
  data.toolsMore = more ? Number(more[1]) : null;
  for (const line of section("Top Skills").split("\n")) {
    // e.g. "  hermes-agent                      16       0      Aug 25"
    const m = line.match(/^\s{2}(\S.*?)\s{2,}([\d,]+)\s{2,}([\d,]+)\s+(\S.*?)\s*$/);
    if (m) data.skills.push({ name: m[1].trim(), loads: num(m[2]), edits: num(m[3]), lastUsed: m[4].trim() });
  }
  return data;
}

async function mirrorCost() {
  let out = null;
  for (const args of [["insights", "--days", "7"], ["insights"]]) {
    try { out = await hermes(args, { timeout: 15000 }); break; } catch { /* try next arg shape */ }
  }
  if (!out) return;
  const parsed = parseInsights(out);

  // Per-model input/output split, read directly from Hermes's local state.db
  // (session_model_usage). The insights CLI only prints totals per model.
  try {
    const { stdout } = await execFileP("sqlite3", [
      path.join(os.homedir(), ".hermes", "state.db"),
      `SELECT u.model, SUM(u.input_tokens), SUM(u.output_tokens), SUM(u.cache_read_tokens)
       FROM session_model_usage u
       JOIN sessions s ON s.id = u.session_id
       WHERE s.started_at >= strftime('%s','now') - 7*86400
       GROUP BY u.model ORDER BY SUM(u.input_tokens)+SUM(u.output_tokens) DESC;`,
    ], { timeout: 10000 });
    const byModelMap = new Map(parsed.byModel.map((m) => [m.model, m]));
    for (const line of stdout.trim().split("\n")) {
      const [model, inTok, outTok, cacheTok] = line.split("|");
      if (!model || !/^\d+$/.test(inTok ?? "") || !/^\d+$/.test(outTok ?? "")) continue;
      // Insights names are display aliases (e.g. "solar-pro4:free" for
      // "upstage/solar-pro4:free") — match on suffix.
      let entry = byModelMap.get(model);
      if (!entry) {
        for (const [k, v] of byModelMap) {
          if (k === model || model.endsWith("/" + k)) { entry = v; break; }
        }
      }
      const cacheRead = /^\d+$/.test(cacheTok ?? "") ? Number(cacheTok) : 0;
      if (entry) {
        entry.inputTokens = Number(inTok);
        entry.outputTokens = Number(outTok);
        entry.cacheReadTokens = cacheRead;
      } else {
        const e = { model, sessions: 0, tokens: Number(inTok) + Number(outTok) + cacheRead, inputTokens: Number(inTok), outputTokens: Number(outTok), cacheReadTokens: cacheRead };
        parsed.byModel.push(e);
        byModelMap.set(model, e);
      }
    }
    parsed.byModel.sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0));
  } catch (e) { log("model token split unavailable:", e.message?.split("\n")[0]); }

  await setStore("hermes-cost", { summary: out.slice(0, 4000), ...parsed, syncedAt: new Date().toISOString() });

  // Daily usage ring buffer: real daily token counts (by session started_at),
  // not deltas of the 7-day rolling total. Powers the spend sparkline with
  // honest per-day usage instead of "how much did the rolling total change?".
  if (parsed.totalTokens != null) {
    try {
      const { stdout: dailyStdout } = await execFileP("sqlite3", [
        path.join(os.homedir(), ".hermes", "state.db"),
        `SELECT date(s.started_at,'unixepoch') as day, SUM(u.input_tokens+u.output_tokens+u.cache_read_tokens) as tokens
         FROM session_model_usage u
         JOIN sessions s ON s.id = u.session_id
         WHERE s.started_at >= strftime('%s','now') - 7*86400
         GROUP BY day ORDER BY day;`,
      ], { timeout: 10000 });
      const dailyDays = [];
      for (const line of dailyStdout.trim().split("\n")) {
        if (!line) continue;
        const sep = line.indexOf("|");
        if (sep < 0) continue;
        const date = line.slice(0, sep);
        const tokens = Number(line.slice(sep + 1));
        if (!isNaN(tokens)) dailyDays.push({ date, tokens });
      }
      // Merge: read existing history from DataStore, keep rows for days outside
      // the 7d window, overwrite any day inside the window with fresh values.
      let existingDays = [];
      try {
        const histRow = await q(`SELECT data FROM "DataStore" WHERE key='hermes-cost-history'`);
        const d = histRow.rows[0]?.data;
        const obj = typeof d === "string" ? JSON.parse(d) : d;
        if (Array.isArray(obj?.days)) existingDays = obj.days;
      } catch { /* fresh history */ }
      const freshDates = new Set(dailyDays.map(d => d.date));
      const merged = existingDays
        .filter((d) => !freshDates.has(d.date))
        .concat(dailyDays)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);
      await setStore("hermes-cost-history", { days: merged });
    } catch (e) { log("daily usage unavailable:", e.message?.split("\n")[0]); }
  }
}

/* ─────────────── OmniRoute usage (local SQLite → Postgres) ─────────────── */
// OmniRoute (http://localhost:20128) persists every proxied LLM call in
// ~/.omniroute/storage.sqlite (call_logs). Its dashboard API needs an
// authenticated session, but the bridge runs on this machine — so read the
// SQLite store directly and mirror a 7d usage summary into DataStore for
// /api/home. Same pattern as mirrorCost(): never fatal, log + skip on error.
async function mirrorOmniRoute() {
  const db = path.join(os.homedir(), ".omniroute", "storage.sqlite");
  if (!fs.existsSync(db)) return;
  const sql = (query) => execFileP("sqlite3", ["-readonly", db, query], { timeout: 10000 });

  // Per-model totals over the trailing 7 days (in/out/cache split).
  const { stdout: byModelOut } = await sql(
    `SELECT model, provider, COUNT(*), SUM(tokens_in), SUM(tokens_out),
            COALESCE(SUM(tokens_cache_read),0)
     FROM call_logs
     WHERE timestamp >= datetime('now','-7 days')
       AND status BETWEEN 200 AND 299
     GROUP BY model, provider ORDER BY SUM(tokens_in)+SUM(tokens_out)+COALESCE(SUM(tokens_cache_read),0) DESC;`
  );
  const byModel = [];
  let totalTokens = 0, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, totalCalls = 0;
  for (const line of byModelOut.trim().split("\n")) {
    if (!line) continue;
    const [model, provider, calls, tin, tout, tcache] = line.split("|");
    if (!model || !/^\d+$/.test(tin ?? "") || !/^\d+$/.test(tout ?? "")) continue;
    const inTok = Number(tin), outTok = Number(tout);
    const cacheTok = /^\d+$/.test(tcache ?? "") ? Number(tcache) : 0;
    const nCalls = /^\d+$/.test(calls ?? "") ? Number(calls) : 0;
    byModel.push({
      model,
      provider,
      calls: nCalls,
      inputTokens: inTok,
      outputTokens: outTok,
      cacheReadTokens: cacheTok,
      tokens: inTok + outTok + cacheTok,
    });
    totalTokens += inTok + outTok + cacheTok;
    inputTokens += inTok;
    outputTokens += outTok;
    cacheReadTokens += cacheTok;
    totalCalls += nCalls;
  }

  // Daily series for the sparkline/history strip (same merge strategy as
  // hermes-cost-history: fresh window overwrites, older rows are kept).
  const { stdout: dailyOut } = await sql(
    `SELECT date(timestamp) as day, SUM(tokens_in+tokens_out+COALESCE(tokens_cache_read,0))
     FROM call_logs
     WHERE timestamp >= datetime('now','-7 days') AND status BETWEEN 200 AND 299
     GROUP BY day ORDER BY day;`
  );
  const dailyDays = [];
  for (const line of dailyOut.trim().split("\n")) {
    if (!line) continue;
    const sep = line.indexOf("|");
    if (sep < 0) continue;
    const date = line.slice(0, sep);
    const tokens = Number(line.slice(sep + 1));
    if (!isNaN(tokens)) dailyDays.push({ date, tokens });
  }
  let existingDays = [];
  try {
    const histRow = await q(`SELECT data FROM "DataStore" WHERE key='omniroute-cost-history'`);
    const d2 = histRow.rows[0]?.data;
    const obj = typeof d2 === "string" ? JSON.parse(d2) : d2;
    if (Array.isArray(obj?.days)) existingDays = obj.days;
  } catch { /* fresh history */ }
  const freshDates = new Set(dailyDays.map((d3) => d3.date));
  const mergedDays = existingDays
    .filter((d3) => !freshDates.has(d3.date))
    .concat(dailyDays)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  await setStore("omniroute-cost", {
    syncedAt: new Date().toISOString(),
    totalTokens: byModel.length ? totalTokens : null,
    inputTokens: byModel.length ? inputTokens : null,
    outputTokens: byModel.length ? outputTokens : null,
    cacheReadTokens,
    totalCalls,
    byModel,
    days: mergedDays,
  });
}

async function mirrorHealth() {
  cleanStaleLocks();
  let online = false, gateway = "unknown", detail = "";
  try {
    const out = await hermes(["status"], { timeout: 12000 });
    detail = out.slice(0, 4000);
    // Check for "running" near "gateway" or "online" keywords
    // The gateway status appears on a separate line from the header, so
    // use a case-insensitive search that doesn't anchor to a single line.
    const lower = out.toLowerCase();
    online = /(online|running|connected)/.test(out);
    // "gateway service" section header followed by "status:" line with
    // optional checkmark and running/online. The lines between them may
    // contain other info (PID, manager, etc.). Match across newlines.
    const gatewayMatch = out.match(/gateway service\s*\n[\s\S]*?status:\s*[✓✗\s]*(running|online)/i);
    gateway = gatewayMatch ? "running" : (lower.includes("gateway") ? "stopped" : "unknown");
  } catch (e) { detail = e.message.split("\n")[0]; }
  await setStore("hermes-health", { online, gateway, detail, lastSeen: new Date().toISOString() });
}

/* ─────────────── Memory Wiki (warm tier: git-tracked markdown) ─────────────── */
function parseEntry(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = {}; let body = md;
  const unq = (s) => {
    const t = s.trim();
    if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))))
      return t.slice(1, -1).trim();
    return t;
  };
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const v = kv[2].trim();
      if (v.startsWith("[") && v.endsWith("]")) fm[kv[1]] = v.slice(1, -1).split(",").map((s) => unq(s)).filter(Boolean);
      else fm[kv[1]] = v === "null" || v === "" ? null : unq(v);
    }
  }
  return { fm, body: body.trim() };
}
function walkMd(dir, out = []) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) { if (it.name !== ".git") walkMd(full, out); }
    else if (it.name.endsWith(".md") && it.name !== "INDEX.md") out.push(full);
  }
  return out;
}
async function mirrorWiki() {
  if (!fs.existsSync(WIKI_DIR)) return;
  const seen = new Set();
  for (const file of walkMd(WIKI_DIR)) {
    const rel = path.relative(WIKI_DIR, file);
    const id = rel.replace(/\.md$/, "");
    seen.add(id);
    let raw = ""; try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
    const { fm, body } = parseEntry(raw);
    await q(
      `INSERT INTO "HermesMemory" (id, path, type, title, status, confidence, provenance, tags, links, body, "validFrom", "validTo", "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())
       ON CONFLICT (id) DO UPDATE SET path=EXCLUDED.path, type=EXCLUDED.type, title=EXCLUDED.title,
         status=EXCLUDED.status, confidence=EXCLUDED.confidence, provenance=EXCLUDED.provenance,
         tags=EXCLUDED.tags, links=EXCLUDED.links, body=EXCLUDED.body,
         "validFrom"=EXCLUDED."validFrom", "validTo"=EXCLUDED."validTo", "syncedAt"=now()`,
      [id, rel, fm.type || "fact", fm.title || id, fm.status || "active", fm.confidence || null,
       fm.provenance || null, Array.isArray(fm.tags) ? fm.tags : [], Array.isArray(fm.links) ? fm.links : [],
       body, fm.valid_from || null, fm.valid_to || null]
    );
  }
  if (seen.size) await q(`DELETE FROM "HermesMemory" WHERE id <> ALL($1::text[])`, [[...seen]]);
  else await q(`DELETE FROM "HermesMemory"`);
}
function writeWikiEntry(e) {
  const rel = e.path || `${e.type || "note"}s/${e.id}.md`;
  const full = path.join(WIKI_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const now = new Date().toISOString().slice(0, 10);
  const lines = [
    "---", `id: ${e.id}`, `type: ${e.type || "note"}`, `title: ${e.title}`,
    `status: ${e.status || "active"}`,
    e.confidence ? `confidence: ${e.confidence}` : null,
    `provenance: ${e.provenance || "dashboard"}`,
    `tags: [${(e.tags || []).join(", ")}]`, `links: [${(e.links || []).join(", ")}]`,
    `updated: ${now}`, "---", "", e.body || "", "",
  ].filter((l) => l !== null);
  fs.writeFileSync(full, lines.join("\n"), "utf8");
  return rel;
}
async function gitCommitWiki(msg) {
  try {
    if (!fs.existsSync(path.join(WIKI_DIR, ".git"))) await execFileP("git", ["-C", WIKI_DIR, "init"]).catch(() => {});
    await execFileP("git", ["-C", WIKI_DIR, "add", "-A"]).catch(() => {});
    await execFileP("git", ["-C", WIKI_DIR, "commit", "-m", msg]).catch(() => {});
  } catch { /* ignore */ }
}

/* ─────────────── Chief-of-staff daily brief ─────────────── */

// Tolerant JSON parser: LLMs fumble strict JSON (single-quoted keys, trailing
// commas, stray fences). Repair the common quirks before giving up, and never
// store the raw JSON blob as the summary text. Returns { brief, parsed } —
// `parsed` is false only when NO JSON object could be recovered (raw prose).
function parseBriefJson(raw) {
  const obj = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim().match(/\{[\s\S]*\}/)?.[0] ?? raw;
  const attempts = [
    (s) => JSON.parse(s),
    // single-quoted keys -> double-quoted, plus trailing commas
    (s) => JSON.parse(
      s.replace(/(^|[,{\[])\s*'([^']+)'\s*:/g, '$1"$2":')
       .replace(/,(\s*[}\]])/g, "$1")
    ),
    // single-quoted keys, then ANY remaining single-quoted tokens (values,
    // array items) -> double-quoted. Apostrophes inside double-quoted text
    // can't match (need a closing quote), so prose survives; if an attempt
    // throws we just fall through to the next one.
    (s) => JSON.parse(
      s.replace(/(^|[,{\[])\s*'([^']+)'\s*:/g, '$1"$2":')
       .replace(/'([^'\n]*)'/g, (m, v) => '"' + v.replace(/"/g, '\\"') + '"')
       .replace(/,(\s*[}\]])/g, "$1")
    ),
    (s) => JSON.parse(s.replace(/,(\s*[}\]])/g, "$1")),
    (s) => JSON.parse(s.replace(/(^|[,{\[])\s*'([^']+)'\s*:/g, '$1"$2":')),
  ];
  for (const parse of attempts) {
    try { const b = parse(obj); if (b && typeof b === "object") return { brief: b, parsed: true }; } catch { /* try next */ }
  }
  // Last resort: pull the readable bits out by regex instead of showing raw JSON.
  // Tolerate either quote char as the value delimiter (models sometimes close with ').
  const greeting = raw.match(/"greeting"\s*:\s*["']([^"']*?)["']/)?.[1] ?? null;
  const summary = raw.match(/"summary"\s*:\s*["']([\s\S]*?)["'](?=\s*[,}\]]|$)/)?.[1] ?? raw.slice(0, 1500);
  return { brief: { greeting, summary, sections: [] }, parsed: false };
}

async function generateBriefing() {
  // hermes -z hangs indefinitely in non-interactive mode (confirmed 2026-09).
  // Route briefings through the kanban system — but MUST use workspace_kind=dir
  // (the old cron did this automatically). Scratch tasks stay "ready" forever
  // because no worker picks them up.
  const BRIEFS_DIR = path.join(os.homedir(), ".hermes", "briefs");
  const today = new Date().toISOString().slice(0, 10);
  const briefTitle = `Daily brief ${today}`;
  const briefBody = briefPrompt();
  const args = [
    "kanban", "--board", BOARD, "create", "--json",
    briefTitle,
    "--body", briefBody,
    "--assignee", "default",
    "--workspace", `dir:${BRIEFS_DIR}`,
    // Removed --idempotency-key so each manual "Generate" click creates a fresh
    // task instead of reusing today's morning brief. The daily cron uses its own
    // schedule; manual clicks should always produce a new brief.
  ];
  try {
    await hermes(args, { timeout: 15000 });
  } catch (e) {
    log(`brief dispatch failed:`, e.message.split("\n")[0].slice(0, 200));
    throw new Error(`brief dispatch failed: ${e.message.split("\n")[0]}`);
  }

  // Poll kanban until a "Daily brief" task appears as done (max 20 min).
  const POLL_INTERVAL = 30_000; // 30s between checks
  const MAX_WAIT_MS = 20 * 60_000; // 20 minutes
  const deadline = Date.now() + MAX_WAIT_MS;
  let briefDone = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    cleanStaleLocks();
    let hermesEnv = { ...process.env };
    const kanbanDbPath = ensureTempKanbanDb();
    if (kanbanDbPath) hermesEnv.HERMES_KANBAN_DB = kanbanDbPath;
    try {
      const out = await hermes(["kanban", "--board", BOARD, "list", "--json"], {
        timeout: 15000,
        env: hermesEnv,
      });
      const parsed = JSON.parse(out || "[]");
      const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
      const briefTask = tasks.find((t) => t.title && t.title.includes("Daily brief") && t.status === "done");
      if (briefTask) {
        briefDone = true;
        break;
      }
    } catch { /* ignore transient errors */ }
  }
  if (!briefDone) {
    log("brief polling timed out after 20 minutes — previous brief kept");
    throw new Error("brief timed out waiting for kanban task to complete after 20 minutes");
  }
  // brief.json will be picked up by mirrorBrief() on the next mirror tick.
  await emit("status", "Daily brief dispatched to kanban", { level: "up" });
}

// Mirror the newest completed "Daily brief" kanban card into the
// hermes-briefing store the dashboard reads. The worker writes the brief JSON
// to <HERMES_BRIEFS_DIR>/brief.json (a dir: workspace, so it survives the
// task); HermesTask.result is not reliably populated.
async function mirrorBrief() {
  const { rows } = await q(
    `SELECT title, "updatedAt" AS task_updated_at FROM "HermesTask"
     WHERE title LIKE 'Daily brief%' AND status='done'
     ORDER BY "updatedAt" DESC LIMIT 1`
  );
  if (!rows.length) return;
  const file = path.join(BRIEFS_DIR, "brief.json");
  let raw = "";
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch { return; }
  const { brief } = parseBriefJson(raw);
  if (typeof brief.summary !== "string") brief.summary = raw.slice(0, 1500);
  if (typeof brief.greeting !== "string") delete brief.greeting;
  // Skip if summary is empty (empty brief = no content)
  if (!brief.summary || brief.summary.trim().length < 10) return;
  const prevRow = (await q(
    `SELECT data FROM "DataStore" WHERE key='hermes-briefing'`
  )).rows[0] ?? {};
  const prev = prevRow.data ?? {};
  // Only update if the content actually changed — never overwrite a good brief
  // with an identical or worse one. Compare summary and greeting.
  const sameContent = prev.summary === brief.summary && prev.greeting === brief.greeting;
  if (sameContent) return;
  // Use current DB time as generatedAt so the dashboard "x ago" label is accurate.
  brief.generatedAt = (await q("SELECT to_char(now() AT TIME ZONE 'GMT', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS t")).rows[0].t;
  await setStore("hermes-briefing", brief);
  await emit("status", "Daily brief synced from kanban", { level: "up" });
  
  // Bridge: Convert "Needs your decision" items to structured Decisions
  await bridgeDecisionsFromBrief(brief);
}

/**
 * Bridge: Convert briefing decision items to structured Decisions
 * This connects the Chief of Staff briefing to the approval inbox.
 *
 * Phase 3: Auto-wiring — when briefing contains structured Decision objects,
 * the bridge emits them directly to Hermes as agent requests instead of
 * just storing them as DB records. This closes the loop:
 * Hermes → briefing → Decision → Hermes task.
 */
async function bridgeDecisionsFromBrief(brief) {
  const decisionSection = brief.sections?.find(s => s.label?.toLowerCase().includes("decision"));
  if (!decisionSection || !Array.isArray(decisionSection.items) || decisionSection.items.length === 0) return;
  
  const createdCount = [];
  const bridgedStructured = [];
  
  for (const item of decisionSection.items) {
    // Handle structured Decision objects from the briefing (Phase 3 auto-wiring)
    if (typeof item === "object" && item !== null && item.kind) {
      await bridgeStructuredDecision(item, decisionSection.label);
      bridgedStructured.push(item.title || item.key);
      continue;
    }
    
    // Handle legacy string items (Phase 2.x)
    if (typeof item !== "string") continue;
    
    // Generate deterministic key from item text
    const key = item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
    
    // Skip if decision already exists (idempotent)
    const existing = await q("SELECT id FROM \"Decision\" WHERE key = $1", [key]);
    if (existing.rows.length > 0) continue;
    
    // Infer kind from keywords
    let kind = "confirm";
    if (/archive|cleanup|remove|delete/i.test(item)) kind = "archive";
    else if (/pin|config|setting|drift/i.test(item)) kind = "pin";
    else if (/resolve|fix|complete|finish/i.test(item)) kind = "resolve";
    
    // Determine actions based on kind
    const actions = kind === "confirm" ? ["approve", "dismiss"] : ["approve", "dismiss", "open"];
    
    // Create decision
    try {
      await q(
        `INSERT INTO "Decision" (id, key, title, body, kind, status, actions, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, now(), now())`,
        [randomUUID(), key, item.slice(0, 100), item, kind, JSON.stringify(actions)]
      );
      createdCount.push(key);
      log(`bridged decision: ${key} (kind=${kind})`);
    } catch (e) {
      log(`failed to bridge decision ${key}:`, e.message);
    }
  }
  
  if (createdCount.length > 0) {
    await emit("status", `Briefing: bridged ${createdCount.length} decision(s) to inbox`, {
      level: "up",
      meta: { decisions: createdCount }
    });
  }
  
  if (bridgedStructured.length > 0) {
    await emit("status", `Briefing: auto-wired ${bridgedStructured.length} structured decision(s) to Hermes`, {
      level: "up",
      meta: { decisions: bridgedStructured }
    });
  }
}

/**
 * Phase 3: Auto-wire a structured Decision object from the briefing
 * directly to Hermes workflow — create an agent request immediately
 * instead of waiting for manual approval in the web UI.
 */
async function bridgeStructuredDecision(decision, sectionLabel) {
  const { title, body, kind = "confirm", key, actionTarget, actions } = decision;
  
  // Generate deterministic key if not provided
  const decisionKey = key || (title || body).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  
  // Skip if decision already exists (idempotent)
  const existing = await q("SELECT id FROM \"Decision\" WHERE key = $1", [decisionKey]);
  if (existing.rows.length > 0) {
    log(`structured decision already exists: ${decisionKey}`);
    return;
  }
  
  // Determine actions based on kind if not provided
  const decisionActions = actions || (kind === "confirm" ? ["approve", "dismiss"] : ["approve", "dismiss", "open"]);
  
  // Create decision record with pending status
  try {
    await q(
      `INSERT INTO "Decision" (id, key, title, body, kind, status, actions, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, now(), now())`,
      [randomUUID(), decisionKey, title?.slice(0, 200) || "Untitled", body || "", kind, JSON.stringify(decisionActions)]
    );
    log(`bridged structured decision: ${decisionKey} (kind=${kind}, from ${sectionLabel})`);
  } catch (e) {
    log(`failed to bridge structured decision ${decisionKey}:`, e.message);
    return;
  }
  
  // Create agent request to Hermes immediately (auto-wiring)
  try {
    const promptData = {
      decisionKey,
      decisionTitle: title,
      decisionBody: body,
      decisionKind: kind,
      actionTarget,
      source: "briefing-auto-wire",
      approvedAt: new Date().toISOString()
    };
    
    await q(
      `INSERT INTO "AgentRequest" (id, origin, kind, title, prompt, sideEffecting, status, decidedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [randomUUID(), "web", `decision.${kind}`, title || decisionKey, JSON.stringify(promptData), kind !== "confirm", kind === "confirm" ? "approved" : "queued"]
    );
    log(`auto-wired decision ${decisionKey} → Hermes agent request`);
  } catch (e) {
    log(`failed to auto-wire decision ${decisionKey} to Hermes:`, e.message);
  }
}

/* ─────────────── Homelab Monitor (optional: mirror homelab-monitor state) ─────────────── */
async function homelabGet(path) {
  if (!HOMELAB_URL) return null;
  const headers = {};
  if (HOMELAB_TOKEN) headers.Authorization = `Bearer ${HOMELAB_TOKEN}`;
  const res = await fetch(`${HOMELAB_URL}${path}`, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`homelab ${path}: HTTP ${res.status}`);
  return res.json();
}

async function mirrorHomelab() {
  if (!HOMELAB_URL) return;
  const [overview, sysHistory, history] = await Promise.allSettled([
    homelabGet("/api/overview"),
    homelabGet("/api/system/history?hours=24"),
    homelabGet("/api/history"),
  ]);
  const data = { syncedAt: new Date().toISOString() };
  if (overview.status === "fulfilled") data.overview = overview.value;
  if (sysHistory.status === "fulfilled") data.systemHistory = sysHistory.value;
  if (history.status === "fulfilled") data.history = history.value;
  if (overview.status !== "fulfilled" && sysHistory.status !== "fulfilled") {
    throw new Error("homelab monitor unreachable");
  }
  await setStore("homelab-monitor", data);
}

/* ─────────────── PUSH: run website requests via Hermes ─────────────── */
async function runRequest(r) {
  const t0 = Date.now();
  // Status is already 'running' — processQueue claims rows atomically
  // (FOR UPDATE SKIP LOCKED) so two bridges can never double-run a request.
  await emit("run", `Started: ${r.title}`, { level: "info", meta: { requestId: r.id, kind: r.kind, host: HOST } });
  try {
    let result = "";
    if (r.kind === "oneshot" || r.kind === "chat") {
      result = (await hermes(["-z", r.prompt || r.title], { timeout: RUN_TIMEOUT_MS })).trim();
    } else if (r.kind === "kanban") {
      // Optional "[agent]" title prefix routes the task to that profile,
      // e.g. "[nova] Implement: …" → hermes kanban create --assignee nova
      const m = /^\[(\w+)\]\s+/.exec(r.title || "");
      const assignee = m ? m[1] : null;
      const cleanTitle = m ? (r.title || "").slice(m[0].length) : r.title;
      const args = ["kanban", "--board", BOARD, "create", "--json", cleanTitle];
      if (assignee) args.push("--assignee", assignee);
      // Pass the request prompt as the task body so workers get full context
      // (proposal details, questions, guidance) — not just a bare title.
      if (r.prompt && r.prompt.trim()) args.push("--body", r.prompt.trim());
      result = (await hermes(args, { timeout: 20000 })).trim();
    } else if (r.kind.startsWith("cron.")) {
      const op = r.kind.split(".")[1];
      const a = JSON.parse(r.prompt || "{}");
      const argv =
        op === "create" ? ["cron", "create", a.schedule, a.prompt || a.name].filter(Boolean)
        : op === "run"    ? ["cron", "run", a.id || a.name]
        : op === "pause"  ? ["cron", "pause", a.id || a.name]
        : op === "resume" ? ["cron", "resume", a.id || a.name]
        : op === "remove" ? ["cron", "remove", a.id || a.name]
        : op === "edit"   ? ["cron", "edit", a.id || a.name]
        : null;
      if (!argv) throw new Error(`unknown cron op ${op}`);
      result = (await hermes(argv, { timeout: 20000 })).trim();
      await mirrorCrons();
    } else if (r.kind === "memory.write") {
      const e = JSON.parse(r.prompt || "{}");
      const rel = writeWikiEntry(e);
      await gitCommitWiki(`wiki: update ${rel} (via dashboard)`);
      await mirrorWiki();
      result = `wrote ${rel}`;
    } else if (r.kind === "briefing.generate") {
      await generateBriefing();
      result = "brief updated";
    } else if (r.kind.startsWith("decision.")) {
      const op = r.kind.split(".")[1]; // archive | confirm | pin | resolve
      let decisionData = {};
      try {
        decisionData = r.prompt ? JSON.parse(r.prompt) : {};
      } catch (e) {
        // Fallback: prompt might be plain text
        decisionData = { rawPrompt: r.prompt };
      }
      
      // Extract decision key for linking
      const decisionKey = decisionData.decisionKey;
      
      if (op === "archive") {
        // Create a kanban task to archive the referenced items
        const target = decisionData.actionTarget;
        const context = target ? ` (related: ${target.type}#${target.id})` : "";
        const archiveTitle = `Archive${context}: ${decisionData.decisionTitle || r.title}`;
        const archivePrompt = decisionData.body || `Archive the following as requested: ${r.prompt}`;
        
        // Assign to "default" agent so workers pick it up immediately
        const assignee = decisionData.assignee || "default";
        const args = ["kanban", "--board", BOARD, "create", "--json", archiveTitle, "--body", archivePrompt, "--assignee", assignee];
        result = (await hermes(args, { timeout: 20000 })).trim();
        
        // Extract task ID from result and link to Decision (Phase 3)
        const taskResult = parseTaskResult(result);
        if (taskResult?.id && decisionKey) {
          await linkDecisionToHermesTask(decisionKey, taskResult.id);
        }
        
        await mirrorKanban();
      } else if (op === "confirm") {
        // Simple confirmation - just log it
        result = `decision confirmed: ${r.title}`;
      } else if (op === "pin") {
        // Pin configuration - store in DataStore
        const pinData = JSON.parse(r.prompt || "{}");
        const storeKey = `decision:pin:${pinData.key || decisionData.key}`;
        await setStore(storeKey, {
          ...pinData,
          pinnedAt: new Date().toISOString(),
          decisionId: decisionData.decisionId
        });
        result = `configuration pinned: ${storeKey}`;
      } else if (op === "resolve") {
        // Resolve - mark related task as done
        const target = decisionData.actionTarget;
        if (target?.type === "task" && target?.id) {
          const args = ["kanban", "--board", BOARD, "done", target.id];
          result = (await hermes(args, { timeout: 20000 })).trim();
          
          // Link decision to Hermes task (Phase 3)
          if (decisionKey) {
            await linkDecisionToHermesTask(decisionKey, target.id);
          }
          
          await mirrorKanban();
        } else {
          result = `decision resolved (no task target)`;
        }
      } else {
        throw new Error(`unknown decision op ${op}`);
      }
    } else {
      throw new Error(`unknown kind ${r.kind}`);
    }
    await q(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`,
      [r.id, result.slice(0, 8000)]);
    await emit("run", `Done: ${r.title}`, { level: "up", detail: result.slice(0, 400), meta: { requestId: r.id, host: HOST } });
    log(`request done: ${r.id} ${r.kind} in ${Math.round((Date.now() - t0) / 1000)}s`);
  } catch (e) {
    // The old code stored `e.stderr || e.message`, which for a timeout kill is
    // the generic "Command failed: hermes -z <700-char prompt>" — the actual
    // cause (signal/exit/duration/output) never fit in the 600-char budget.
    const durS = Math.round((Date.now() - t0) / 1000);
    const bits = [];
    if (e.killed || e.signal) bits.push(`killed by ${e.signal || "signal"}${e.timeout ? ` after ${Math.round(e.timeout / 1000)}s` : ""}`);
    else if (e.code != null && e.code !== 0) bits.push(`exit ${e.code}`);
    const tail = (s) => (s || "").toString().trim().split("\n").slice(-3).join(" | ").slice(0, 300);
    const body = tail(e.stderr) || tail(e.stdout) || (e.message || "error").split("\n")[0];
    const msg = `[${HOST}] ${r.kind} failed after ${durS}s: ${bits.length ? bits.join(", ") + " — " : ""}${body}`.slice(0, 600);
    await q(`UPDATE "AgentRequest" SET status='failed', error=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`, [r.id, msg]);
    await emit("run", `Failed: ${r.title}`, { level: "down", detail: msg, meta: { requestId: r.id, host: HOST } });
    log("request failed:", r.id, msg);
  }
}

async function processQueue() {
  // Reclaim orphans: a bridge restart (or crash) mid-run leaves the row stuck
  // at 'running' forever — nothing ever picks it up again. Anything running
  // longer than the run timeout cannot still be alive, so fail it.
  await q(
    `UPDATE "AgentRequest" SET status='failed', error=$2, "finishedAt"=now(), "updatedAt"=now()
     WHERE status='running' AND "startedAt" < now() - make_interval(secs => $1)`,
    [Math.ceil(RUN_TIMEOUT_MS / 1000) + 60, `[${HOST}] reclaimed: run exceeded timeout (bridge likely restarted mid-run)`]
  );
  // Atomic claim: the subquery locks candidate rows (SKIP LOCKED), so when two
  // bridges poll the same DB each request is claimed by exactly one runner —
  // no double hermes runs, and startedAt marks who moved first.
  const { rows } = await q(
    `UPDATE "AgentRequest" SET status='running', "startedAt"=now(), "updatedAt"=now()
     WHERE id IN (
       SELECT id FROM "AgentRequest"
       WHERE status IN ('queued','approved')
       ORDER BY "createdAt" ASC LIMIT 3
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );
  for (const r of rows) await runRequest(r);
}

/* ─────────────── loops ─────────────── */
async function mirrorTick() {
  try { await mirrorKanban(); } catch (e) { log("mirrorKanban err", e.message); }
  let cronOut = null;
  try { cronOut = await mirrorCrons(); } catch (e) { log("mirrorCrons err", e.message); }
  try { healCronDrift(cronOut).catch((e) => log("healCronDrift err", e.message)); } catch (e) { log("healCronDrift err", e.message); }
  try { await mirrorHealth(); } catch (e) { log("mirrorHealth err", e.message); }
  try { await mirrorWiki(); } catch (e) { log("mirrorWiki err", e.message); }
  try { await mirrorCost(); } catch (e) { log("mirrorCost err", e.message); }
  try { await mirrorOmniRoute(); } catch (e) { log("mirrorOmniRoute err", e.message); }
  try { await mirrorBrief(); } catch (e) { log("mirrorBrief err", e.message); }
  try { await mirrorHomelab(); } catch (e) { log("mirrorHomelab err", e.message); }
  try { await healStuckKanban(); } catch (e) { log("healStuckKanban err", e.message); }
}

async function main() {
  log(`hermes-bridge up · host=${HOST} · board=${BOARD} · poll=${POLL_MS}ms · mirror=${MIRROR_MS}ms · run-timeout=${RUN_TIMEOUT_MS}ms`);
  await emit("status", "Bridge connected", { level: "up", meta: { host: HOST } });
  await mirrorTick();
  setInterval(() => mirrorTick().catch((e) => log("mirror loop", e.message)), MIRROR_MS);
  // queue loop — NOTE: cleanStaleLocks() is NOT called here. It runs in
  // mirrorTick() every 30s. Calling it here every 5s caused an infinite
  // clean loop (locks recreated within seconds, threshold of 10s was too
  // aggressive).
  const tick = async () => { try { await processQueue(); } catch (e) { log("queue loop", e.message); } finally { setTimeout(tick, POLL_MS); } };
  tick();
}
main().catch((e) => { console.error("fatal", e); process.exit(1); });
