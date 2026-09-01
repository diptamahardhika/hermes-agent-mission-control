#!/usr/bin/env node
/**
 * Bridge smoke test — safe to ignore.
 *
 * Verifies the hermes-bridge can start, reach Postgres, and mirror the
 * local kanban board into HermesTask. Designed to be run by hand or from
 * the dashboard; failures are reported, not thrown.
 *
 * Usage: node smoke-test.mjs   (run from the hermes-bridge dir)
 */

import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileP = promisify(execFile);

// ── load .env the same way bridge.mjs does ────────────────────────────────
for (const line of fs.existsSync(path.join(__dirname, ".env"))
  ? fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")
  : []) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  process.env[m[1]] = v;
}

const DB_URL = process.env.DATABASE_URL || "";
const BOARD = process.env.HERMES_BOARD || "default";
const HERMES_BIN = process.env.HERMES_BIN || "hermes";
const PASS = "\u2705 PASS";
const FAIL = "\u274c FAIL";
const SEP = "─".repeat(60);

let failures = 0;
const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? PASS : FAIL}  ${name}${detail ? " — " + detail : ""}`);
}

// ── 1. Environment ─────────────────────────────────────────────────────────
console.log("\n" + SEP);
console.log("Bridge Smoke Test");
console.log(`host: ${os.hostname()}  board: ${BOARD}`);
console.log(SEP);

record("DATABASE_URL is set", DB_URL.length > 0, DB_URL ? `${DB_URL.slice(0, 40)}…` : "missing");
record("DATABASE_URL is direct postgres:// (not prisma://)",
  !DB_URL.startsWith("prisma://") && !DB_URL.startsWith("prisma+"),
  DB_URL.slice(0, 20) || "n/a");

const isLocal = DB_URL.match(/@(localhost|127\.0\.0\.1)/) ? true : null;
// classification is informational; we already have a connection to judge by
record("DB host classification", true, isLocal ? "local" : "cloud (SSL)");

// ── 2. Postgres connectivity ───────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: DB_URL, max: 2, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
let pgHealthy = false;
try {
  const ts = await pool.query("SELECT NOW() AS t");
  if (ts.rows[0]) {
    pgHealthy = true;
    record("Postgres reachable", true, `server time: ${ts.rows[0].t}`);
  }
} catch (e) {
  record("Postgres reachable", false, e.message.split("\n")[0].slice(0, 120));
}
if (!pgHealthy) {
  await pool.end();
  console.log(`\n${FAIL}  DB unreachable — aborting remaining checks.`);
  process.exit(1);
}

// ── 3. Schema validation ───────────────────────────────────────────────────
const requiredTables = [
  "AgentRequest", "AgentEvent", "DataStore",
  "HermesTask", "HermesMemory",
];
const optionalTables = ["HomelabState"];

const { rows: existing } = await pool.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
);
const existingSet = new Set(existing.map(r => r.table_name));

for (const t of requiredTables) {
  record(`table ${t} exists`, existingSet.has(t), existingSet.has(t) ? "present" : "MISSING");
}
for (const t of optionalTables) {
  record(`table ${t} exists (optional)`, true, existingSet.has(t) ? "present" : "absent (ok)");
}

// ── 4. Hermes CLI ──────────────────────────────────────────────────────────
let hermesOk = false;
try {
  const { stdout } = await execFileP(HERMES_BIN, ["--version"], { timeout: 10000 });
  const firstLine = stdout.trim().split("\n")[0];
  hermesOk = true;
  record("Hermes CLI reachable", true, firstLine.slice(0, 80));
} catch (e) {
  record("Hermes CLI reachable", false, e.message.split("\n")[0].slice(0, 120));
}

// ── 5. Kanban mirror (PULL path) ──────────────────────────────────────────
if (hermesOk && pgHealthy) {
  try {
    // Check if there are any stale lock files (older than 5 minutes) and clean them
    const lockPath = path.join(os.homedir(), ".hermes", "kanban.db.init.lock");
    let locksCleaned = false;
    if (fs.existsSync(lockPath)) {
      const lockStats = fs.statSync(lockPath);
      if (Date.now() - lockStats.mtimeMs > 300000) { // older than 5 minutes
        fs.unlinkSync(lockPath);
        locksCleaned = true;
      }
    }
    
    const out = await execFileP(HERMES_BIN, ["kanban", "--board", BOARD, "list", "--json"], { timeout: 15000 });
    const parsed = JSON.parse(out.stdout || "[]");
    const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
    record("kanban list --json parses", tasks.length >= 0, `returned ${tasks.length} task(s)`);
    if (locksCleaned) {
      record("stale lock cleanup", true, "removed stale lock file (age > 5m)");
    } else {
      record("stale lock cleanup", true, "no stale locks (age <= 5m)");
    }

    // Dry-run insert into HermesTask to verify the mirror target table is writable
    const sampleId = `smoke-test-${Date.now()}`;
    await pool.query(
      `INSERT INTO "HermesTask" (id, board, title, assignee, status, priority, result, "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [sampleId, BOARD, "smoke-test placeholder", "smoke-test", "todo", 0, null]
    );
    const verify = await pool.query(`SELECT id FROM "HermesTask" WHERE id=$1`, [sampleId]);
    record("HermesTask writeable", verify.rows.length === 1, verify.rows.length === 1 ? "row inserted" : "conflict/insert failed");
    // clean up
    await pool.query(`DELETE FROM "HermesTask" WHERE id=$1`, [sampleId]);
  } catch (e) {
    record("kanban mirror dry-run", false, e.message.split("\n")[0].slice(0, 150));
  }
}

// ── 6. DataStore round-trip ────────────────────────────────────────────────
// NOTE: pg returns jsonb columns as parsed JS objects, not strings.
// The bridge's setStore() stores them as JSON.stringify() — but on read
// pg parses them back to objects. So for the smoke test we compare objects,
// not JSON strings.
try {
  const testKey = `smoke-${Date.now()}`;
  const testData = { smoke: true, when: new Date().toISOString() };
  await pool.query(
    `INSERT INTO "DataStore" (key, data, "updatedAt") VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, "updatedAt"=now()`,
    [testKey, JSON.stringify(testData)]
  );
  const row = await pool.query(`SELECT data FROM "DataStore" WHERE key=$1`, [testKey]);
  // pg returns jsonb as a parsed object (or string if it couldn't parse)
  const raw = row.rows[0]?.data;
  const got = typeof raw === "string" ? JSON.parse(raw) : raw;
  record("DataStore round-trip", got && got.smoke === true, `stored+read key ${testKey}`);
  await pool.query(`DELETE FROM "DataStore" WHERE key=$1`, [testKey]);
} catch (e) {
  record("DataStore round-trip", false, e.message.split("\n")[0].slice(0, 150));
}

// ── 7. AgentEvent emit ─────────────────────────────────────────────────────
try {
  await pool.query(
    `INSERT INTO "AgentEvent" (id, kind, title, detail, agent, level, meta, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
    [`smoke-${Date.now()}`, "smoke", "Bridge smoke test ran", null, "smoke-test", "info", null]
  );
  record("AgentEvent writeable", true, "event inserted");
} catch (e) {
  record("AgentEvent writeable", false, e.message.split("\n")[0].slice(0, 150));
}

await pool.end();

// ── summary ────────────────────────────────────────────────────────────────
console.log("\n" + SEP);
const passed = checks.length - failures;
console.log(`Results: ${passed}/${checks.length} checks passed`);
if (failures === 0) {
  console.log(`${PASS}  Bridge smoke test passed — no action needed.`);
  process.exit(0);
} else {
  console.log(`${FAIL}  ${failures} check(s) failed — see details above.`);
  process.exit(1);
}
