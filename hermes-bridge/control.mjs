// Bidirectional control handlers for hermes-bridge
// Extracted from bridge.mjs to bring bridge.mjs under 1000 lines
// Dependencies injected: q, setStore, emit, log, fs, path, __dirname, bridgePid

export async function runControl(r, deps) {
  const { q, setStore, emit, log, fs, path, bridgePid } = deps;
  let result;

  if (r.kind === "control.sync_all") {
    await mirrorTick();
    await generateBriefing();
    await mirrorKanban();
    await mirrorBrief();
    result = "sync_all complete: all channels mirrored";
  } else if (r.kind === "control.refresh_briefing") {
    await generateBriefing();
    await mirrorKanban();
    await mirrorBrief();
    result = "briefing refreshed";
  } else if (r.kind === "control.bridge_restart") {
    const restartDelayMs = Number(r.prompt || "{}")?.delayMs || 5000;
    await setStore("bridge-restart-scheduled", {
      scheduledAt: new Date().toISOString(),
      delayMs: restartDelayMs,
      requestedBy: r.id,
    });
    await emit("status", "Bridge restart scheduled", { level: "warn", meta: { requestId: r.id, delayMs: restartDelayMs } });
    const alreadyRestarting = await q(
      "SELECT 1 FROM \"AgentRequest\" WHERE kind='control.bridge_restart' AND status='running' AND id != $1 AND \"createdAt\" > now() - make_interval(secs => 120) LIMIT 1",
      [r.id]
    );
    if (alreadyRestarting.rows.length > 0) {
      result = "bridge_restart skipped: another restart already in-flight";
    } else {
      result = "bridge_restart scheduled in " + restartDelayMs + "ms";
      // DB update FIRST — must persist before the restart file exists
      await q(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`,
        [r.id, result.slice(0, 8000)]);
      // Write restart file with fsync for durability before process.exit
      const restartInfo = {
        pid: bridgePid,
        scheduledAt: new Date().toISOString(),
        delayMs: restartDelayMs,
        requestId: r.id
      };
      const restartFd = fs.openSync(path.join(__dirname, ".restart-requested"), 'w');
      fs.writeFileSync(restartFd, JSON.stringify(restartInfo));
      fs.fsyncSync(restartFd);
      fs.closeSync(restartFd);
      setTimeout(() => { process.exit(0); }, restartDelayMs);
    }
  } else {
    throw new Error(`unknown kind ${r.kind}`);
  }

  return result;
}

export async function runControlPostUpdate(r, result, deps) {
  const { q, emit, log, HOST } = deps;
  await q(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1`,
    [r.id, result.slice(0, 8000)]);
  await emit("run", `Done: ${r.title}`, { level: "up", detail: result.slice(0, 400), meta: { requestId: r.id, host: HOST } });
  log(`request done: ${r.id} ${r.kind} in ${Math.round((Date.now() - r.t0) / 1000)}s`);
}

export function getWatchdogCheck(q, fs, path, __dirname, bridgePid, WATCHDOG_TIMEOUT_MS) {
  return async function watchdogCheck() {
    try {
      const health = await q("SELECT data FROM \"DataStore\" WHERE key = 'hermes-health'");
      const healthData = health.rows[0]?.data ? JSON.parse(health.rows[0].data) : null;
      const gatewayDown = !healthData?.gateway?.includes("running");
      const lastSeen = healthData?.lastSeen ? new Date(healthData.lastSeen).getTime() : 0;
      const stalled = Date.now() - lastSeen > WATCHDOG_TIMEOUT_MS;
      if (gatewayDown && stalled) {
        log("watchdog: gateway DOWN + stalled — triggering bridge_restart");
        fs.writeFileSync(path.join(__dirname, ".restart-requested"), JSON.stringify({
          pid: bridgePid,
          scheduledAt: new Date().toISOString(),
          delayMs: 1000,
          requestId: "watchdog-" + Date.now()
        }));
        process.exit(0);
      }
    } catch (e) {
      log("watchdog tick error:", e.message.split("\n")[0]);
    }
  };
}
