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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**ALL AGENTS — Max, Sage, Knox, Nova, Pixel — must use graphify first when working on code in this project.** Before grepping files or reading source directly:

```bash
graphify query "<question>"     # broad context
graphify path "A" "B"           # shortest path between concepts
graphify explain "<symbol>"     # node + its neighbors
graphify update .               # after any code change (AST-only, free)
```

If `graphify-out/graph.json` doesn't exist yet, build it: `/graphify .`

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
