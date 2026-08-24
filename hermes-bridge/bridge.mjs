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
  try {
    const out = await hermes(["cron", "list", "--all"], { timeout: 15000 });
    const lines = out.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    await setStore("hermes-crons", { jobs: lines, raw: out.slice(0, 8000), syncedAt: new Date().toISOString() });
  } catch (e) { log("cron list failed:", e.message.split("\n")[0]); }
}

// Parse the fixed-text output of `hermes insights` into structured usage data.
// The CLI has no --json flag (verified), so this regexes the Overview block and
// the Models Used table. Returns nulls for anything not found — never guesses.
export function parseInsights(text) {
  const num = (s) => Number(String(s).replace(/,/g, ""));
  const grab = (re) => { const m = text.match(re); return m ? num(m[1]) : null; };
  const data = {
    sessions: grab(/Sessions:\s*([\d,]+)/),
    messages: grab(/Messages:\s*([\d,]+)/),
    toolCalls: grab(/Tool calls:\s*([\d,]+)/),
    inputTokens: grab(/Input tokens:\s*([\d,]+)/),
    outputTokens: grab(/Output tokens:\s*([\d,]+)/),
    totalTokens: grab(/Total tokens:\s*([\d,]+)/),
    byModel: [],
  };
  const modelsIdx = text.indexOf("Models Used");
  if (modelsIdx !== -1) {
    const seg = text.slice(modelsIdx);
    const table = seg.includes("\n\n") ? seg.slice(0, seg.indexOf("\n\n")) : seg;
    for (const line of table.split("\n")) {
      // e.g. "  solar-pro4:free     129   136,714,672"
      const m = line.match(/^\s{2}(\S.*?)\s{2,}(\d+)\s+([\d,]+)\s*$/);
      if (m) data.byModel.push({ model: m[1].trim(), sessions: num(m[2]), tokens: num(m[3]) });
    }
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
      `SELECT model, SUM(input_tokens), SUM(output_tokens), SUM(cache_read_tokens) FROM session_model_usage
       WHERE last_seen > strftime('%s','now') - 7*86400 GROUP BY model ORDER BY SUM(input_tokens)+SUM(output_tokens) DESC;`,
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

  // Daily snapshot ring buffer: each sync stamps today's trailing-7-day totals.
  // Day-over-day deltas between snapshots approximate daily usage and power the
  // home dashboard's spend sparkline. Only stamp when we actually parsed tokens,
  // so a parse failure can't poison the history with zeros.
  if (parsed.totalTokens == null) return;
  const today = new Date().toISOString().slice(0, 10);
  let days = [];
  try {
    const histRow = await q(`SELECT data FROM "DataStore" WHERE key='hermes-cost-history'`);
    const d = histRow.rows[0]?.data;
    const obj = typeof d === "string" ? JSON.parse(d) : d;
    if (Array.isArray(obj?.days)) days = obj.days;
  } catch { /* fresh history */ }
  const entry = {
    date: today,
    totalTokens: parsed.totalTokens,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    sessions: parsed.sessions,
  };
  const i = days.findIndex((d) => d.date === today);
  if (i >= 0) days[i] = entry; else days.push(entry);
  await setStore("hermes-cost-history", { days: days.slice(-60) });
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
  // Weak/fallback models fumble structured output; a single flake used to fail
  // the whole dispatch. Briefs are idempotent, so retry — worst case we keep
  // the previous brief (never store garbage over a good one).
  const attempts = Number(process.env.BRIDGE_BRIEF_ATTEMPTS || 3);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 2000));
    let raw = "";
    try {
      raw = (await hermes(["-z", briefPrompt()], { timeout: RUN_TIMEOUT_MS })).trim();
    } catch (e) {
      log(`brief attempt ${attempt}/${attempts}: cli error`, (e.message || e).toString().split("\n")[0].slice(0, 160));
      continue;
    }
    const { brief, parsed } = parseBriefJson(raw);
    // A strict/repaired JSON object IS a brief even with zero sections (every
    // section legitimately empty). Only raw prose with no recoverable JSON
    // stays invalid — storing that over a good brief is worse than keeping it.
    const valid = parsed && typeof brief.summary === "string" && brief.summary.trim().length > 0;
    if (valid) {
      if (typeof brief.greeting !== "string") delete brief.greeting;
      // DB clock, not local: the Mac's clock can be briefly wrong after wake and a
      // skewed generatedAt poisons "x ago" labels and mirrorBrief's dedupe.
      brief.generatedAt = (await q("SELECT to_char(now() AT TIME ZONE 'GMT', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS t")).rows[0].t;
      await setStore("hermes-briefing", brief);
      await emit("status", "Daily brief generated", { level: "up" });
      if (attempt > 1) log(`brief generated on attempt ${attempt}/${attempts}`);
      return;
    }
    // Keep the full payload for post-mortem — the head alone hid why valid-looking
    // output failed validation.
    try { fs.writeFileSync(path.join(os.tmpdir(), "hermes-brief-failed.json"), raw); } catch { /* best effort */ }
    log(`brief attempt ${attempt}/${attempts}: output not valid JSON; head:`, raw.slice(0, 800));
  }
  throw new Error(`brief output was not valid JSON after ${attempts} attempts — previous brief kept`);
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
  const { brief } = parseBriefJson(raw);
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
  try { await mirrorCrons(); } catch (e) { log("mirrorCrons err", e.message); }
  try { await mirrorHealth(); } catch (e) { log("mirrorHealth err", e.message); }
  try { await mirrorWiki(); } catch (e) { log("mirrorWiki err", e.message); }
  try { await mirrorCost(); } catch (e) { log("mirrorCost err", e.message); }
  try { await mirrorBrief(); } catch (e) { log("mirrorBrief err", e.message); }
  try { await mirrorHomelab(); } catch (e) { log("mirrorHomelab err", e.message); }
}

async function main() {
  log(`hermes-bridge up · host=${HOST} · board=${BOARD} · poll=${POLL_MS}ms · mirror=${MIRROR_MS}ms · run-timeout=${RUN_TIMEOUT_MS}ms`);
  await emit("status", "Bridge connected", { level: "up", meta: { host: HOST } });
  await mirrorTick();
  setInterval(() => mirrorTick().catch((e) => log("mirror loop", e.message)), MIRROR_MS);
  // queue loop
  const tick = async () => { try { await processQueue(); } catch (e) { log("queue loop", e.message); } finally { setTimeout(tick, POLL_MS); } };
  tick();
}
main().catch((e) => { console.error("fatal", e); process.exit(1); });
