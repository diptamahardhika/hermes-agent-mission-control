// Fixtures are the real captured outputs from `hermes status` and
// `hermes status --full` on this machine (macOS, launchd gateway), plus the
// degraded shapes the CLI can emit when it cannot probe the gateway.
import test from "node:test";
import assert from "node:assert/strict";
import { parseGatewayState } from "./health-parse.mjs";

// Verbatim from `hermes status` — the layout the bridge actually calls.
const SUMMARY_RUNNING = `
┌─────────────────────────────────────────────────────────┐
│                 ☤ Hermes Agent Status                  │
└─────────────────────────────────────────────────────────┘

  Model:        stealth/space-bunny-alpha
  Provider:     Nous Portal
  Providers:    hermes-omniroute, Free LLM API, OpenCode Zen, OpenRouter, Nous Portal, Ollama Cloud, GitHub Copilot, Anthropic, Google AI Studio
  Gateway:      ✓ running
  Platforms:    Discord, Slack
  Jobs:         10 active, 10 total

  Run 'hermes status --full' for every section
`;

// _kv_flag renders the same row with ✗ and the "stopped" text.
const SUMMARY_STOPPED = SUMMARY_RUNNING.replace("✓ running", "✗ stopped");

// Satellite profile served by the default profile's multiplexer (_gateway_state).
const SUMMARY_MULTIPLEXER = SUMMARY_RUNNING.replace(
  "✓ running",
  "✓ running (via the default-profile multiplexer)"
);

// Verbatim from `hermes status --full`.
const FULL_RUNNING = `
◆ Nous Tool Gateway
  Your Nous Portal account has no usable paid credits.

◆ Gateway Service
  Status:       ✓ running
  Manager:      launchd
  PID(s):       21886, 21844
  Serves:       coq, knox, nova, pixel, sage

◆ Scheduled Jobs
`;

const FULL_STOPPED = FULL_RUNNING.replace("✓ running", "✗ stopped");

// _render_summary's except branch writes a bare value with no ✓/✗ mark.
const SUMMARY_UNKNOWN = SUMMARY_RUNNING.replace("✓ running", "unknown");

test("summary layout: running gateway (the real output)", () => {
  assert.equal(parseGatewayState(SUMMARY_RUNNING), "running");
});

test("summary layout: stopped gateway", () => {
  assert.equal(parseGatewayState(SUMMARY_STOPPED), "stopped");
});

test("summary layout: gateway up via another profile's multiplexer", () => {
  assert.equal(parseGatewayState(SUMMARY_MULTIPLEXER), "running");
});

test("full layout: running gateway section", () => {
  assert.equal(parseGatewayState(FULL_RUNNING), "running");
});

test("full layout: stopped gateway section", () => {
  assert.equal(parseGatewayState(FULL_STOPPED), "stopped");
});

test("unmarked/unrecognized value reports unknown, never stopped", () => {
  assert.equal(parseGatewayState(SUMMARY_UNKNOWN), "unknown");
});

test("no gateway evidence at all reports unknown", () => {
  const noGateway = SUMMARY_RUNNING.split("\n").filter((l) => !/Gateway:/.test(l)).join("\n");
  assert.equal(parseGatewayState(noGateway), "unknown");
});

test("garbage and non-string input are unknown, not a false 'stopped'", () => {
  assert.equal(parseGatewayState("traceback (most recent call last): boom"), "unknown");
  assert.equal(parseGatewayState(""), "unknown");
  assert.equal(parseGatewayState(undefined), "unknown");
  assert.equal(parseGatewayState(null), "unknown");
});

// The bug this parser exists for: the old inline regex only matched the full
// layout, so the summary layout always fell through to "stopped".
test("regression: summary output that the old regex rejected is running", () => {
  const old = SUMMARY_RUNNING.match(
    /gateway service\s*\n[\s\S]*?status:\s*[✓✗\s]*(running|online)/i
  );
  assert.equal(old, null, "old regex must fail on summary output — that was the bug");
  assert.equal(parseGatewayState(SUMMARY_RUNNING), "running");
});

// A false "stopped" drives healStuckKanban dispatch nudges and the watchdog's
// bridge_restart trigger, so the ✗ mark must win even when the text is odd.
test("explicit ✗ mark wins over surrounding running text", () => {
  const odd = `
  Gateway:      ✗ stopped (was running earlier)
`;
  assert.equal(parseGatewayState(odd), "stopped");
});