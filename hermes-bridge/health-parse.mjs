// Gateway-state parser for `hermes status` output.
//
// Lives in its own module because bridge.mjs cannot be imported by a test:
// it reads DATABASE_URL at module load and starts mirror/queue/watchdog
// intervals as a side effect of being required. This file has no side effects,
// so `node --test hermes-bridge/health-parse.test.mjs` exercises it directly.
//
// Two output layouts exist and both are live:
//   summary (default `hermes status`, hermes_cli/status.py _render_summary)
//       "  Gateway:      ✓ running"
//       "  Gateway:      ✗ stopped"
//   full (`hermes status --full`, _render_gateway → _section("Gateway Service"))
//       "◆ Gateway Service\n  Status:       ✓ running\n  Manager: ..."
//
// The summary layout is tried first because the bridge calls plain `status`.
// The full layout is the fallback so a future switch to `--full` (or a
// truncated summary) still resolves instead of degrading to "stopped".

/**
 * Parse the gateway state out of `hermes status` output.
 * @param {string} out raw stdout from `hermes status`
 * @returns {"running"|"stopped"|"unknown"}
 */
export function parseGatewayState(out) {
  if (typeof out !== "string" || out === "") return "unknown";

  // Summary layout: a "Gateway:" row, optionally flagged ✓/✗. The value may be
  // "running", "stopped", or "running (via the default-profile multiplexer)" —
  // _gateway_state() in status.py returns the parenthetical form for a
  // satellite profile served by the default profile's gateway.
  const summary = out.match(/^[^\S\n]*Gateway:[^\S\n]*([✓✗])?[^\S\n]*(\S.*?)[^\S\n]*$/im);
  if (summary) {
    const mark = summary[1];
    const text = summary[2].toLowerCase();
    if (mark === "✗" || text.startsWith("stopped")) return "stopped";
    if (mark === "✓" || text.startsWith("running")) return "running";
    // A present-but-unrecognized value ("unknown") is not proof of a stop.
    return "unknown";
  }

  // Full layout: the "Gateway Service" section header, then a "Status:" row.
  // Match across newlines because PID/manager rows may sit between them.
  const full = out.match(/gateway service\s*\n[\s\S]*?status:[^\S\n]*([✓✗])?[^\S\n]*(running|online|stopped|offline)/i);
  if (full) {
    const value = full[2].toLowerCase();
    return value === "running" || value === "online" ? "running" : "stopped";
  }

  // No gateway evidence at all — distinct from "gateway reported stopped".
  return "unknown";
}