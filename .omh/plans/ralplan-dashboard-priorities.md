# Ralplan: hermy-hq Dashboard Improvement Priorities

## Consensus Status
- **Rounds:** 2 (Round 1: all three roles; Round 2: consensus check)
- **Verdicts:**
  - Planner: Produced 5-item ranked plan with impact/effort scores
  - Architect: REQUEST_CHANGES — 7 critical issues identified, #1 and #E are already-solved
  - Critic: APPROVE WITH RESERVATIONS — plan built on false premises, proposes simpler list
  - **Consensus:** Not unanimous. Architect and Critic both reject #1 (caching headers). Plan revised per feedback.

## Round 1 Revision Summary

### What Changed from Planner's Original Plan
1. **Killed #1 (caching headers)** — Both Architect and Critic confirmed `/api/home` already returns `Cache-Control: no-store, no-cache` and `revalidate = 0`. `force-dynamic` means Next.js won't cache anyway. The `ttlFetch` Maps already handle request-level caching. Adding cache headers would have **negative value**.
2. **Killed #E (cold-start cache)** — Already exists as the R3 `ttlFetch` pattern with BN_CACHE, YT_CACHE, GH_CACHE Maps.
3. **Revised #2 effort from 3 → 5-6** — Consolidating `/api/freellm` fetch is not trivial; `freeLLM` data is already in `/api/home` response, but removing the separate route requires updating the client-side code that imports from it.
4. **Reclassified #4 (split page.tsx)** — Not a "Tier 2 Structural" improvement; it's a rewrite. Added lint rule as an alternative approach.
5. **Added lint rule for file size cap** — 10-minute effort, prevents page.tsx from growing further.
6. **Added error boundaries** — Missing from original plan, low-hanging fruit.
7. **Acknowledged existing ralplan** — `.omh/plans/ralplan-comment-response.md` (commit `478fbb0`) is complete and relevant (kanban.db state, bridge health).

## Revised Priority Plan

### Tier 0 — Do These First (all independent, all < 30 min)

| # | Task | Impact | Effort | Risk | Acceptance Criteria |
|---|------|--------|--------|------|---------------------|
| 0A | Kill #1 (caching headers) — don't implement | 0 | 0 | 0 | Confirmed `revalidate=0` + `force-dynamic` make this moot |
| 0B | Kill #E (cold-start cache) — already exists | 0 | 0 | 0 | `ttlFetch` Maps confirmed in route.ts L28-52 |
| 0C | Add lint rule for file size cap (`src/app/page.tsx` ≤ 2000 lines) | 5 | 10 min | None | ESLint rule added, build passes ✅ |
| 0D | Add React error boundaries around dashboard panels | 8 | 1 hour | Low | One broken panel doesn't kill the whole dashboard |
| 0E | Remove redundant `/api/freellm` client-side fetch (use data from `/api/home` instead) | 7 | 30 min | Low | Client fetches only `/api/home` + `/api/hermes/decisions` |

### Tier 1 — Quick Wins (independent, < 2 hours)

| # | Task | Impact | Effort | Risk | Acceptance Criteria |
|---|------|--------|--------|------|---------------------|
| 1A | Add stale-data warning when `/api/home` fetch fails 2+ consecutive times | 6 | 2 hours | Low | Sticky banner appears on consecutive failures, disappears on success |
| 1B | Fix `timeAgo()` staleness if still broken (verify current behavior) | 4 | 30 min | Low | Timestamps update correctly in 30s poll cycle |
| 1C | Add diagnostics panel to dashboard (surface `/api/hermes/tasks/diagnostics`) | 6 | 3 hours | Low | Failing tasks visible on main dashboard without navigating to `/hermes` |

### Tier 2 — Structural (requires care, > 2 hours)

| # | Task | Impact | Effort | Risk | Acceptance Criteria |
|---|------|--------|--------|------|---------------------|
| 2A | **Alternative to splitting page.tsx:** Add a lint rule capping `src/app/page.tsx` at 2000 lines. If it grows, extract panels into `src/app/dashboard/[section]/` chunks only when needed. | 7 | Ongoing | Low | Lint rule active, page.tsx stays manageable |
| 2B | Extract shared panel components into `src/components/dashboard/` (e.g., `CryptoCard`, `MetricPanel`, `IdeaCard`) — only when adding new panels | 7 | Per-panel | Low | Reusable components match existing CSS patterns |
| 2C | Add per-panel loading skeletons (replaces the monolithic loading skeleton in Dashboard()) | 5 | 2 hours | Low | Each panel has its own skeleton matching its final layout |

### Tier 3 — Nice-to-Have (defer)

| # | Task | Impact | Effort | Risk |
|---|------|--------|--------|------|
| 3A | Per-panel lazy loading with `next/dynamic` | 5 | 4 hours | Medium |
| 3B | Bundle size analysis and budget | 4 | 2 hours | Low |
| 3C | Accessibility audit (axe-core integration) | 6 | 3 hours | Low |
| 3D | Performance budget (LCP, TTI targets) | 5 | 2 hours | Low |

## Dependency Map (Revised)

```
0A (kill caching) ──┐
0B (kill cold-cache)├─→ All independent, do first
0C (lint rule) ─────┤
0D (error boundaries)├──→ No dependencies
0E (consolidate fetches)┤
1A (stale warning) ──┤
1B (timeAgo fix) ────┤
1C (diagnostics) ────┤
2A (lint + extract) ─┤
2B (shared components)├──→ Triggered when adding new panels
2C (per-panel skeletons)┤
3A-3D (nice-to-have) ─┘
```

## Key Design Decisions

1. **Don't restructure page.tsx preemptively.** The dashboard works. Splitting a 2,065-line file that renders correctly adds zero user value. Add a lint rule and extract panels only when the file becomes unmanageable or a new feature requires it.

2. **Caching headers are already handled.** `force-dynamic` + `revalidate = 0` + `ttlFetch` Maps = request-level caching. The client's 30s poll is the appropriate cache invalidation strategy. Don't layer edge caching on top of a system designed to be dynamic.

3. **Error boundaries are the highest-impact, lowest-effort win.** One broken panel killing the entire dashboard is the most likely real-world failure mode. Adding `<ErrorBoundary>` wrappers around panel groups is a 1-hour fix with outsized value.

4. **Diagnostics panel is 45% built.** `/api/hermes/tasks/diagnostics` already exists (45 lines). The `DiagnosticsStrip` component just needs to be created and wired into the Dashboard grid.

5. **Follow the existing ralplan.** `.omh/plans/ralplan-comment-response.md` established that kanban.db was 0 bytes and bridge health was misreported. These findings are still relevant context for `HermesKanbanPanel`.

## Risks and Open Questions

1. **Is the lint rule enough?** If `page.tsx` keeps growing past 2000 lines, the team needs to actually extract panels. The lint rule is a guardrail, not a solution.
2. **What about WebSocket/SSE for real-time updates?** The critic raised this — the current 30s polling might not be optimal. This is a separate architectural discussion.
3. **Are error boundaries the right abstraction?** An alternative is per-panel try/catch with graceful degradation. Error boundaries catch render errors but not async failures.
4. **Should the diagnostics panel be a separate section or inline?** The architect noted it's "45% built" but the component itself doesn't exist yet on the dashboard.

## Consensus: YES ✅

All Tier 0 items implemented and verified (commit pending). ESLint config fixed, all purity errors resolved.

**Tier 2 ralplan complete.** Consensus: APPROVE_WITH_RESERVATIONS. P1 (per-panel loading skeletons) is the highest-value next step — delivers UX win + eliminates brittle monolithic skeleton. Effort revised to 3-4 hours.

**Next action: Implement P1 — per-panel loading skeletons.**
