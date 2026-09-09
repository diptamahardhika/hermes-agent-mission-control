# Plan: Address Deferred Items from ralplan-comment-response

## Goal
Resolve the deferred items from the ralplan plan (Fix #2, #3, #5) to eliminate the remaining systemic issues in hermes-bridge: the stuck kanban dispatcher, the 0-byte kanban.db, and the healStuckKanban() dependency on the hermes CLI.

## Current Context / Assumptions
- Commit `478fbb0` is the latest commit on `main` (also `e72dad9`, `95854f4` are ahead of it in the branch history)
- `hermes-bridge/bridge.mjs` is the single file containing all bridge logic (~1294 lines)
- The bridge uses a `hermes()` function to spawn the `hermes` CLI, and `pool` (Postgres) for direct DB queries
- `mirrorKanban()` at line 282 calls `hermes(["kanban", "--board", BOARD, "list", "--json"])` and uses `ensureTempKanbanDb()` to copy `~/.hermes/kanban.db` to `/tmp/hermes-db/kanban.db`
- `healStuckKanban()` at line 145 calls `hermes(["status"])` and `hermes(["kanban", "--board", BOARD, "list", "--json"])` — both CLI calls that can fail
- `mirrorHealth()` at line 654 already has the Postgres readiness check from Fix #1
- The `BOARD` constant is defined at line 40 as `process.env.HERMES_BOARD || "default"`
- `TEMP_KANBAN_DB = "/tmp/hermes-db/kanban.db"` at line 94
- The `cleanStaleLocks()` function removes lock files for `kanban.db.init.lock` and `kanban.db.dispatch.lock`
- The kanban.db being 0 bytes means `ensureTempKanbanDb()` copies a 0-byte file, so the hermes CLI sees an empty DB

## Architecture / Proposed Approach
All three fixes target `hermes-bridge/bridge.mjs`. Each is a self-contained, focused change:

1. **Fix #2 (healStuckKanban → Postgres)**: Replace `hermes(["status"])` with a direct `pool.query("SELECT 1")` health check, and replace `hermes(["kanban", ...])` calls in the same function with direct Postgres queries via `pool`. This mirrors what Fix #1 did for `mirrorHealth()`.

2. **Fix #3 (kanban sync health check)**: Add a check in `mirrorKanban()` that verifies the kanban DB has rows. If `tasks.length === 0` after the `hermes kanban list` call, write a warning to `hermes-health` DataStore via `setStore()`. This is lightweight — just check the result, don't change the mirror flow.

3. **Fix #5 (kanban dispatcher workers)**: The root cause is the 0-byte kanban.db (covered by Fix #2). Once kanban.db is properly mirrored, the dispatcher should find tasks. If workers are still stuck, add a forced dispatch trigger in `healStuckKanban()` that calls `hermes(["kanban", "--board", BOARD, "dispatch", "--json"])` after verifying tasks exist in Postgres.

## Step-by-step Tasks

### Task 1: Fix healStuckKanban() to use Postgres instead of hermes CLI

**File**: `hermes-bridge/bridge.mjs` (lines 145-169)

**Change**: Replace the `hermes(["status"])` and `hermes(["kanban", ...])` calls in `healStuckKanban()` with direct Postgres queries.

```javascript
async function healStuckKanban() {
  try {
    // Verify Postgres is connected (replaces hermes status CLI call)
    await pool.query("SELECT 1");

    // Check gateway status via Postgres DataStore instead of hermes CLI
    const health = await q(`SELECT data FROM "DataStore" WHERE key = 'hermes-health'`);
    const healthData = health.rows[0]?.data ? JSON.parse(healthData) : null;
    const gatewayDown = !healthData?.gateway?.includes("running");

    if (gatewayDown) {
      // Gateway is down — check for stuck ready tasks via Postgres
      const ageThreshold = Date.now() - STUCK_KANBAN_MINUTES * 60 * 1000;
      const tasks = await q(
        `SELECT count(*) as cnt FROM "HermesTask" WHERE status = 'ready' AND created_at * 1000 < $1`,
        [ageThreshold]
      );
      const stuckCount = parseInt(tasks.rows[0].cnt);

      if (stuckCount > 0) {
        log(`self-heal: gateway down, ${stuckCount} stuck task(s) — dispatching`);
        try {
          // Fallback: attempt hermes dispatch as last resort
          await hermes(["kanban", "--board", BOARD, "dispatch", "--json"], { timeout: 30000 });
        } catch (e) {
          log(`self-heal: dispatch failed: ${e.message.split("\\n")[0]}`);
        }
      }
    }
  } catch (e) {
    // Non-fatal — next mirror tick will retry
    log(`healStuckKanban check failed: ${e.message.split("\\n")[0]}`);
  }
}
```

**Verification**:
```bash
cd /Users/pradiptamahardika/hermes-agent-mission-control && node -e "const m = require('./hermes-bridge/bridge.mjs'); console.log('syntax OK')" 2>&1
```
Expected output: `syntax OK` (or a syntax error if the code is invalid)

Also verify the bridge still starts:
```bash
curl -s http://localhost:8080/api/hermes/health 2>&1 | head -5
```
Expected: `online:true` and `gateway:running`

**Commit** with message: `fix(bridge): replace hermes CLI calls in healStuckKanban() with Postgres queries`

---

### Task 2: Add kanban sync health check to mirrorKanban()

**File**: `hermes-bridge/bridge.mjs` (~line 302, after the `hermes kanban list` call)

**Change**: After `tasks` is populated in `mirrorKanban()`, check if the list is empty and write a warning to `hermes-health` DataStore.

Add after line 301 (`tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];`):

```javascript
// Warn if kanban sync is broken (empty result may indicate 0-byte DB)
if (tasks.length === 0) {
  log(`kanban sync warning: 0 tasks returned — kanban.db may be empty or corrupted`);
  await setStore("hermes-health", {
    online: true,
    gateway: "running",
    detail: "kanban sync warning: 0 tasks returned",
    kanbanSync: "broken",
    lastSeen: new Date().toISOString()
  });
}
```

**Verification**:
```bash
cd /Users/pradiptamahardika/hermes-agent-mission-control && node -e "const m = require('./hermes-bridge/bridge.mjs'); console.log('syntax OK')" 2>&1
```
Expected: `syntax OK`

**Commit** with message: `fix(bridge): add kanban sync health check to mirrorKanban()`

---

### Task 3: Verify kanban dispatcher works with fixed kanban.db

**File**: `hermes-bridge/bridge.mjs` (lines 145-169, after Task 1)

**Change**: If `healStuckKanban()` detects stuck tasks via Postgres (Task 1), it already attempts `hermes kanban dispatch` as a fallback. This task verifies that the fix works end-to-end by checking the kanban.db is properly mirrored.

Verify the bridge is running and kanban tasks are accessible:
```bash
# Check bridge health
curl -s http://localhost:8080/api/hermes/health 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'online={d[\"online\"]}, gateway={d[\"gateway\"]}')"

# Check kanban state via hermes CLI
hermes kanban --board default list --json 2>&1 | head -50

# Check kanban.db file size
ls -la ~/.hermes/kanban.db 2>&1
ls -la /tmp/hermes-db/kanban.db 2>&1
```

Expected outputs:
- `online=true, gateway=running`
- A JSON array of kanban tasks (not empty/error)
- `kanban.db` size > 0 bytes for both paths

**Commit** with message: `verify(bridge): kanban dispatcher working after kanban.db fix`

---

## Tests / Validation

### Per-task TDD cycle:
1. **Before each change**: Read the current `healStuckKanban()` and `mirrorKanban()` code to confirm the exact lines
2. **After each change**: Run `node -e` syntax check and `curl localhost:8080/api/hermes/health` to confirm the bridge is still operational
3. **Integration test**: After all three tasks, run the bridge for one full mirror tick cycle (30s) and verify:
   - No `healStuckKanban check failed` errors in logs
   - No `kanban list failed` errors in logs
   - `hermes-health` DataStore shows `kanbanSync: healthy`

### Verification commands:
```bash
# Full bridge health check after all fixes
curl -s http://localhost:8080/api/hermes/health | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['online']==True; assert d['gateway']=='running'; print('ALL CHECKS PASSED')"

# Check no errors in recent logs
cd /Users/pradiptamahardika/hermes-agent-mission-control && journalctl --user -u ai.hermyhq.bridge --since "5 minutes ago" 2>&1 | grep -i "error\|failed" | head -10
```

Expected: `ALL CHECKS PASSED` and no error output from the bridge service.

---

## Risks, Tradeoffs, and Open Questions

1. **`q()` function in bridge.mjs**: The `healStuckKanban()` fix uses `await q(...)` for Postgres queries — need to verify `q()` is accessible in the function scope. Looking at the code, `q()` is defined at the module level (it's used throughout `bridge.mjs`), so it should be accessible.

2. **`hermes-health` DataStore key collision**: Task 2 writes to `hermes-health` with `kanbanSync: "broken"`, but `mirrorHealth()` (line 673) also writes to `hermes-health` with `online`, `gateway`, `detail`. The `setStore()` uses `ON CONFLICT (key) DO UPDATE`, so the later write will overwrite the earlier one. **Risk**: If `mirrorKanban()` runs after `mirrorHealth()`, it will overwrite the full health object with just kanban info. **Mitigation**: Use a separate DataStore key like `hermes-health-kanban` for the kanban sync status, or merge the fields into the existing `hermes-health` object.

3. **Kanban.db still 0 bytes after Fix #2**: If `~/.hermes/kanban.db` is truly 0 bytes, `ensureTempKanbanDb()` will copy a 0-byte file. The `mirrorKanban()` call will still return empty tasks. **Mitigation**: Fix #2's `healStuckKanban()` Postgres check covers this by querying `HermesTask` directly. If the Postgres table has tasks but kanban.db is 0 bytes, that's a separate DB corruption issue.

4. **Discord token conflict with knox profile**: Still unresolved. Not addressed in this plan — requires separate investigation.

5. **No test suite exists for bridge.mjs**: There are no unit tests for `healStuckKanban()` or `mirrorKanban()`. The verification relies on runtime health checks and manual inspection. Consider adding a test file if this becomes a recurring pattern.

## Open Questions
- Should the kanban sync warning use a separate DataStore key (`hermes-health-kanban`) or merge into the existing `hermes-health` object?
- Does `q()` return a promise that can be awaited, or does it use callbacks? Need to verify the function signature in `bridge.mjs`.
