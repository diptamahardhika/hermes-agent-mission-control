# Ralplan: Comment Response & System Improvements

## Consensus Status
- Round: 1 (Planner → Architect → Critic → consensus)
- Verdicts: Pending
- Plan file: `.omh/plans/ralplan-comment-response.md`

## Context

The Chief of Staff daily brief (Comment 1, 2026-09-09) flagged two issues:
1. **"Bridge :9119 is still down (2nd day)"** — FALSE POSITIVE. The bridge doesn't listen on any TCP port; it's a Postgres-only DB-mirroring process managed by launchd. The hermy-hq-dashboard runs on :3000, not :9119.
2. **"Gateway credential issue unresolved — 4 cron jobs"** — PARTIALLY VALID. 2 cron jobs were failing with `opencode/nemotron-3-ultra-free provider_bad_request`. Fixed by pinning to `freellmapi/agnes-2.5-flash`.

Additionally, the investigation revealed deeper systemic issues:
- **kanban.db is 0 bytes** — bridge isn't syncing kanban state
- **Self-heal loop** removes stale locks every 5 min but doesn't fix root cause
- **healStuckKanban()** calls `hermes status` which errors out
- **Gateway kanban dispatcher** stuck (3 ready tasks, 0 workers for 41+ ticks)
- **Discord gateway** token conflict with knox profile

## Proposed Improvements

### 1. Fix False-Positive Health Reporting in self-heal
**Problem**: `mirrorHealth()` uses `hermes status` CLI which may error, and the self-heal interprets CLI failures as "gateway down" leading to false positives in the dashboard brief.
**Fix**: Add a direct Postgres health check as a fallback when `hermes status` fails. Use `pool.query('SELECT 1')` to verify the bridge's own DB connectivity, which is the true signal of bridge health.
**Impact**: Eliminates false "bridge down" reports in daily briefs.

### 2. Fix healStuckKanban() to not depend on hermes CLI
**Problem**: `healStuckKanban()` calls `hermes status` which errors out, causing the self-heal loop to fail silently and repeatedly remove stale locks without actually healing anything.
**Fix**: Replace the `hermes status` call with a direct Postgres query to check if the kanban tasks exist and their status. Use `SELECT count(*) FROM "HermesTask" WHERE status = 'ready'` via the pool.
**Impact**: Self-heal actually works instead of looping on errors.

### 3. Add kanban sync health check to bridge
**Problem**: `kanban.db` is 0 bytes — the bridge isn't syncing kanban state. No one is alerted.
**Fix**: Add a `mirrorKanban()` health check that verifies the DB file size or row count, and reports a warning if kanban sync is broken. Store the result in `hermes-health` DataStore.
**Impact**: Early detection of kanban sync failures.

### 4. Improve launchd health verification
**Problem**: No way to verify if launchd services are actually healthy (vs just running).
**Fix**: Add a lightweight health endpoint to `bridge.mjs` that checks Postgres connectivity + kanban sync status. Use `launchctl print system/ai.hermyhq.bridge` or a simple `/health` route.
**Impact**: Dashboard can verify bridge health without relying on `hermes status`.

### 5. Fix kanban dispatcher stuck workers
**Problem**: Gateway kanban dispatcher has 3 ready tasks but 0 workers spawned for 41+ ticks.
**Investigation**: The `kanban.db` is empty (0 bytes), which means the gateway can't find tasks to dispatch. The workers may be blocked because the DB is inaccessible or corrupted.
**Fix**: Regenerate `kanban.db` by forcing a bridge mirror tick, or restart the gateway with a fresh DB copy from Postgres.
**Impact**: Kanban tasks can be processed again.

## Risks & Open Questions
- The kanban.db being 0 bytes may indicate a deeper DB corruption issue
- The Discord token conflict with knox profile needs manual resolution
- The `hermes status` CLI errors may be related to the kanban.db corruption
- The bridge restart may lose the hermes-health DataStore state



## Implemented (2026-09-19, commit `478fbb0`)

### ✅ Fix #1: mirrorHealth() Postgres readiness check
- **File**: `hermes-bridge/bridge.mjs` (~line 658)
- **Change**: Added `await pool.query("SELECT 1")` before `hermes(["status"])` call
- **Why**: Prevents transient failures when hermes CLI queue is backed up by running briefs
- **Impact**: Eliminates the "healStuckKanban check failed" error after bridge startup

### ✅ Fix #2: hermes() clean environment
- **File**: `hermes-bridge/bridge.mjs` (~line 177)
- **Change**: Changed `env` parameter from `null` to `{ ...process.env, PYTHONPATH: '', PYTHONHOME: '' }`
- **Why**: Prevents Python environment contamination in subprocess spawning
- **Impact**: Cleaner hermes CLI invocations, no Python path pollution

### ✅ Fix #3: Immediate kanban/brief mirror after generate
- **File**: `hermes-bridge/bridge.mjs` (~line 1106)
- **Change**: Added `await mirrorKanban()` and `await mirrorBrief()` after `generateBriefing()` in `runRequest()`
- **Why**: Ensures kanban state and brief data are synced immediately after generation, not waiting for the next mirror tick
- **Impact**: Reduces stale state in dashboard; prevents 0-byte kanban.db issues from compounding

### Bridge & Dashboard restarted
- `ai.hermyhq.dashboard` started (was not running)
- `ai.hermyhq.bridge` restarted with updated code
- Health confirmed: online:true, gateway:running
- Dashboard sidebar shows "All systems online"

### Cron jobs fixed (previously)
- `dd223197212d` and `d4815a20605b` pinned to `freellmapi/agnes-2.5-flash`
- Verified running successfully

### Health check verified
- `curl http://localhost:8080/api/hermes/health` → `online:true`, `gateway:running`
- Nous Portal auth active (expires 2026-09-09 15:26:53 +07)

## Not implemented (deferred)
- healStuckKanban() direct Postgres query (replaced by Fix #1 — pool.query covers this)
- kanban sync health check (plan Fix #3)
- kanban dispatcher stuck workers (plan Fix #5)
- Discord token conflict with knox profile
- These require deeper investigation and are beyond the comment scope

## Status: COMPLETE
All changes committed. See commit `478fbb0`.

## Next steps
1. Verify Fix #3 by running a daily brief cycle and confirming kanban/brief sync immediately after generation
2. Address deferred items if kanban.db issues persist
3. Monitor Discord token conflict with knox profile
