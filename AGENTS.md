# hermes-agent-mission-control

## Operator mandates
- **"Shipped it" means the full release flow, every time:** commit → open PR → merge into `main` → delete the branch (remote and local) if one was created. Never stop at commit or push and call it shipped.
- **Shipped only when the operator says so:** never kick off the release flow — or declare work "shipped/done" — on your own initiative. When work is finished, leave it in the working tree (or a local commit) and report it's *ready*; run commit → PR → merge → delete only when the operator explicitly says to ship.
- **Self-healing is a first-class requirement for this dashboard.** When a failure mode is detected (cron drift_skip, failed enqueues, stale syncs), prefer wiring automatic detection + repair into the hermes-bridge mirror loop or watchdog jobs over one-off manual fixes. Manual fixes are acceptable only as stopgaps until automated.
- After editing `hermes-bridge/bridge.mjs`, the running bridge process must be restarted to pick up changes — it does not hot-reload. Mirror tick interval is 30s (`MIRROR_MS`).
- **Workflow discipline:** For any bounded or non-trivial task, I must present the design in chat first, then pause for explicit operator approval before implementation. I shall not skip the approval gate even when the task seems simple or low-risk. If I implement without approval, you can say "you missed the gate" and I will redo the task the correct way (present design → wait for approval → implement).
- **Reflection practice:** Periodically (after each merged PR / after each session), I will review whether I skipped the approval gate and note it, so patterns can be corrected over time.

## Agent Commitments

## Ops facts
- Hermes cron jobs can be skipped by `drift_skip` guard when the global inference config drifts and the job is unpinned. The error text itself names the new target model (`model 'old' -> 'new'`) — parse it to auto-pin via `hermes cron edit <id> --provider <p> --model <m>`.
- Bridge mirrors Hermes state into Postgres DataStore keys (`hermes-cost`, `hermes-crons`, ...). `/api/hermes/*` routes read those keys; UI falls back gracefully when structured fields are absent.
