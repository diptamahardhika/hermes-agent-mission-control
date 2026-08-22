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
const BOARD = process.env.HERMES_BOARD || "default";
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 5000);
const MIRROR_MS = Number(process.env.BRIDGE_MIRROR_MS || 30000);
const RUN_TIMEOUT_MS = Number(process.env.BRIDGE_RUN_TIMEOUT_MS || 240000);
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
    "Keep every item short, concrete, and specific. Omit a section if it has nothing. " +
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

// The hermes CLI owns a single session slot; concurrent invocations fight over
// it and fail ("Command failed: hermes ..."). Serialize every call through a
// chain so mirrors + queue runs never overlap.
let hermesChain = Promise.resolve();
function hermes(args, { timeout = 30000 } = {}) {
  const run = hermesChain.then(async () => {
    const { stdout } = await execFileP(HERMES, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  });
  hermesChain = run.catch(() => {});
  return run;
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
  let tasks = [];
  try {
    // NB: this Hermes CLI wants --board BEFORE the subcommand.
    const out = await hermes(["kanban", "--board", BOARD, "list", "--json"], { timeout: 15000 });
    const parsed = JSON.parse(out || "[]");
    tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch (e) { log("kanban list failed:", e.message.split("\n")[0]); return; }

  const seen = new Set();
  for (const t of tasks) {
    const id = String(t.id ?? t.task_id ?? "");
    if (!id) continue;
    seen.add(id);
    await q(
      `INSERT INTO "HermesTask" (id, board, title, assignee, status, priority, result, "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, assignee=EXCLUDED.assignee, status=EXCLUDED.status,
         priority=EXCLUDED.priority, result=EXCLUDED.result, "syncedAt"=now()`,
      [id, BOARD, String(t.title ?? "untitled").slice(0, 300), t.assignee ?? null,
       String(t.status ?? "todo"), t.priority != null ? Number(t.priority) : null,
       t.result ? String(t.result).slice(0, 2000) : null]
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
  try {
    const out = await hermes(["cron", "list", "--all"], { timeout: 15000 });
    const lines = out.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    await setStore("hermes-crons", { jobs: lines, raw: out.slice(0, 8000), syncedAt: new Date().toISOString() });
  } catch (e) { log("cron list failed:", e.message.split("\n")[0]); }
}

async function mirrorCost() {
  for (const args of [["insights", "--days", "7"], ["insights"]]) {
    try {
      const out = await hermes(args, { timeout: 15000 });
      await setStore("hermes-cost", { summary: out.slice(0, 4000), syncedAt: new Date().toISOString() });
      return;
    } catch { /* try next arg shape */ }
  }
}

async function mirrorHealth() {
  let online = false, gateway = "unknown", detail = "";
  try {
    const out = await hermes(["status"], { timeout: 12000 });
    detail = out.slice(0, 4000);
    online = /online|running|connected/i.test(out);
    gateway = /gateway[^\n]*(running|online)/i.test(out) ? "running" : "stopped";
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
// store the raw JSON blob as the summary text.
function parseBriefJson(raw) {
  const obj = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim().match(/\{[\s\S]*\}/)?.[0] ?? raw;
  const attempts = [
    (s) => JSON.parse(s),
    // single-quoted keys -> double-quoted, plus trailing commas
    (s) => JSON.parse(
      s.replace(/(^|[,{\[])\s*'([^']+)'\s*:/g, '$1"$2":')
       .replace(/,(\s*[}\]])/g, "$1")
    ),
    (s) => JSON.parse(s.replace(/,(\s*[}\]])/g, "$1")),
    (s) => JSON.parse(s.replace(/(^|[,{\[])\s*'([^']+)'\s*:/g, '$1"$2":')),
  ];
  for (const parse of attempts) {
    try { const b = parse(obj); if (b && typeof b === "object") return b; } catch { /* try next */ }
  }
  // Last resort: pull the readable bits out by regex instead of showing raw JSON.
  // Tolerate either quote char as the value delimiter (models sometimes close with ').
  const greeting = raw.match(/"greeting"\s*:\s*["']([^"']*?)["']/)?.[1] ?? null;
  const summary = raw.match(/"summary"\s*:\s*["']([\s\S]*?)["'](?=\s*[,}\]]|$)/)?.[1] ?? raw.slice(0, 1500);
  return { greeting, summary, sections: [] };
}

async function generateBriefing() {
  const raw = (await hermes(["-z", briefPrompt()], { timeout: RUN_TIMEOUT_MS })).trim();
  const brief = parseBriefJson(raw);
  // A real brief always has sections; raw prose (LLM flake) never does. Storing
  // garbage over a good brief is worse than keeping the old one, so reject it.
  const valid =
    typeof brief.summary === "string" && brief.summary.trim().length > 0 &&
    Array.isArray(brief.sections) && brief.sections.length > 0;
  if (!valid) {
    log("brief output not valid JSON; keeping previous brief. head:", raw.slice(0, 200));
    throw new Error("brief output was not valid JSON — previous brief kept");
  }
  if (typeof brief.greeting !== "string") delete brief.greeting;
  // DB clock, not local: the Mac's clock can be briefly wrong after wake and a
  // skewed generatedAt poisons "x ago" labels and mirrorBrief's dedupe.
  brief.generatedAt = (await q("SELECT to_char(now() AT TIME ZONE 'GMT', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS t")).rows[0].t;
  await setStore("hermes-briefing", brief);
  await emit("status", "Daily brief generated", { level: "up" });
}

// Mirror the newest completed "Daily brief" kanban card into the
// hermes-briefing store the dashboard reads. The worker writes the brief JSON
// to <HERMES_BRIEFS_DIR>/brief.json (a dir: workspace, so it survives the
// task); HermesTask.result is not reliably populated.
async function mirrorBrief() {
  const { rows } = await q(
    `SELECT title FROM "HermesTask"
     WHERE title LIKE 'Daily brief%' AND status='done'
     ORDER BY "updatedAt" DESC LIMIT 1`
  );
  if (!rows.length) return;
  const file = path.join(BRIEFS_DIR, "brief.json");
  let raw = "", mtime = null;
  try {
    const st = fs.statSync(file);
    raw = fs.readFileSync(file, "utf8");
    mtime = st.mtime.toISOString();
  } catch { return; }
  const brief = parseBriefJson(raw);
  if (typeof brief.summary !== "string") brief.summary = raw.slice(0, 1500);
  if (typeof brief.greeting !== "string") delete brief.greeting;
  const prevRow = (await q(
    `SELECT data, EXTRACT(EPOCH FROM "updatedAt") AS updated_epoch
     FROM "DataStore" WHERE key='hermes-briefing'`
  )).rows[0] ?? {};
  const prev = prevRow.data ?? {};
  // Compare against the DB write time (absolute epoch), never the embedded
  // generatedAt — a locally-skewed generatedAt used to block fresh briefs.
  if (prevRow.updated_epoch && new Date(mtime).getTime() / 1000 <= Number(prevRow.updated_epoch)) return;
  if (prev.summary === brief.summary && prev.greeting === brief.greeting && prev.generatedAt === mtime) return;
  brief.generatedAt = mtime;
  await setStore("hermes-briefing", brief);
  await emit("status", "Daily brief synced from kanban", { level: "up" });
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
  await q(`UPDATE "AgentRequest" SET status='running', "startedAt"=now(), "updatedAt"=now() WHERE id=$1`, [r.id]);
  await emit("run", `Started: ${r.title}`, { level: "info", meta: { requestId: r.id, kind: r.kind } });
  try {
    let result = "";
    if (r.kind === "oneshot" || r.kind === "chat") {
      result = (await hermes(["-z", r.prompt || r.title], { timeout: RUN_TIMEOUT_MS })).trim();
    } else if (r.kind === "kanban") {
      result = (await hermes(["kanban", "--board", BOARD, "create", "--json", r.title], { timeout: 20000 })).trim();
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
    } else {
      throw new Error(`unknown kind ${r.kind}`);
    }
    await q(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`,
      [r.id, result.slice(0, 8000)]);
    await emit("run", `Done: ${r.title}`, { level: "up", detail: result.slice(0, 400), meta: { requestId: r.id } });
  } catch (e) {
    const msg = (e.stderr || e.message || "error").toString().split("\n")[0].slice(0, 600);
    await q(`UPDATE "AgentRequest" SET status='failed', error=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`, [r.id, msg]);
    await emit("run", `Failed: ${r.title}`, { level: "down", detail: msg, meta: { requestId: r.id } });
    log("request failed:", r.id, msg);
  }
}

async function processQueue() {
  const { rows } = await q(
    `SELECT * FROM "AgentRequest" WHERE status IN ('queued','approved') ORDER BY "createdAt" ASC LIMIT 3`
  );
  for (const r of rows) await runRequest(r);
}

/* ─────────────── loops ─────────────── */
async function mirrorTick() {
  try { await mirrorKanban(); } catch (e) { log("mirrorKanban err", e.message); }
  try { await mirrorCrons(); } catch (e) { log("mirrorCrons err", e.message); }
  try { await mirrorHealth(); } catch (e) { log("mirrorHealth err", e.message); }
  try { await mirrorWiki(); } catch (e) { log("mirrorWiki err", e.message); }
  try { await mirrorCost(); } catch (e) { log("mirrorCost err", e.message); }
  try { await mirrorBrief(); } catch (e) { log("mirrorBrief err", e.message); }
  try { await mirrorHomelab(); } catch (e) { log("mirrorHomelab err", e.message); }
}

async function main() {
  log(`hermes-bridge up · board=${BOARD} · poll=${POLL_MS}ms · mirror=${MIRROR_MS}ms`);
  await emit("status", "Bridge connected", { level: "up" });
  await mirrorTick();
  setInterval(() => mirrorTick().catch((e) => log("mirror loop", e.message)), MIRROR_MS);
  // queue loop
  const tick = async () => { try { await processQueue(); } catch (e) { log("queue loop", e.message); } finally { setTimeout(tick, POLL_MS); } };
  tick();
}
main().catch((e) => { console.error("fatal", e); process.exit(1); });
