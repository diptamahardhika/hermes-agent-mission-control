# hermes-agent-mission-control

## Operator mandates
- **Self-healing is a first-class requirement for this dashboard.** When a failure mode is detected (cron drift_skip, failed enqueues, stale syncs), prefer wiring automatic detection + repair into the hermes-bridge mirror loop or watchdog jobs over one-off manual fixes. Manual fixes are acceptable only as stopgaps until automated.
- After editing `hermes-bridge/bridge.mjs`, the running bridge process must be restarted to pick up changes — it does not hot-reload. Mirror tick interval is 30s (`MIRROR_MS`).

## Ops facts
- Hermes cron jobs can be skipped by `drift_skip` guard when the global inference config drifts and the job is unpinned. The error text itself names the new target model (`model 'old' -> 'new'`) — parse it to auto-pin via `hermes cron edit <id> --provider <p> --model <m>`.
- Bridge mirrors Hermes state into Postgres DataStore keys (`hermes-cost`, `hermes-crons`, ...). `/api/hermes/*` routes read those keys; UI falls back gracefully when structured fields are absent.
