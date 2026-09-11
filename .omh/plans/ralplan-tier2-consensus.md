# Ralplan: Tier 2 Structural Improvements — Consensus Plan

## Consensus Status
- **Rounds:** 1 (Planner + Architect + Critic)
- **Verdicts:**
  - Planner: APPROVE — per-panel skeletons is the highest-value item
  - Architect: APPROVE_WITH_RESERVATIONS — P1 effort underestimated (2h → 3-4h), recommend shared loading registry
  - Critic: APPROVE_WITH_RESERVATIONS — P1 misframed as "structural" (it's UX), P3 is not actionable, suggest reusing existing data null-checks for loading state
- **Consensus:** APPROVE_WITH_RESERVATIONS — implement P1 with revised estimate and simplifications

## Key Insights from Reviews

### 1. The Real Problem Isn't File Size
`page.tsx` is at **1947 effective code lines** (101 blank + 51 comment stripped), comfortably under the 2000-line cap with 53 lines of headroom. The lint rule is working. The actual user-facing problem is:

> **No per-panel loading states** — users see a blank skeleton grid for ~1-2s, then everything loads at once.

### 2. Per-Panel Skeletons Solve Two Problems
- **UX win:** Users see progress per panel (staggered reveal as data arrives)
- **Maintenance win:** Eliminates the brittle monolithic skeleton mirror (lines 1800-1842) that must be updated manually when panel heights change

### 3. Simplified Loading State Approach
Most panels already track loading via their data state (e.g., `const [news, setNews] = useState<AINewsData | null>(null)` — if `news` is null, it's loading). Don't add a separate `loading` boolean everywhere; reuse existing patterns.

## Final Prioritized Plan

### P1: Per-Panel Loading Skeletons ⭐ HIGH VALUE
- **Effort:** 3–4 hours (revised from 2h)
- **Impact:** 7/10 — user-visible UX improvement + implicit skeleton maintenance fix
- **Approach:**
  1. Use existing data null-checks as loading signals where possible
  2. Add explicit `loading` state only where data can legitimately be null (e.g., empty results)
  3. Create `<PanelSkeleton>` component using existing `<Skeleton>` from `@/components/ui/kit`
  4. Keep monolithic skeleton as fallback for initial paint, switch to per-panel once panels mount
  5. Add `aria-busy` or equivalent for accessibility
- **Acceptance criteria:**
  - Each panel shows skeleton placeholder matching its final layout
  - No layout shift on load
  - Panels appear staggered as data arrives
  - Monolithic skeleton removed or used only as fallback
- **Verdict:** ✅ APPROVE — implement first

### P2: Extract Large Inline Components (Reactively)
- **Effort:** ~15-30 min per extraction (incremental)
- **Impact:** 5/10 — developer ergonomics, not user-facing
- **Approach:** Extract to `src/components/dashboard/` only when:
  - Adding a new panel would push past 2000 effective lines, OR
  - A specific panel becomes difficult to maintain in isolation
- **Pattern:** Follow `DiagnosticsStrip` example (48 lines, clean interface)
- **Verdict:** ✅ APPROVE — follow pattern when needed, don't preempt

### P3: Monitor Lint Headroom (Passive)
- **Effort:** 0 (lint rule already handles this)
- **Action:** None required — the guardrail is working
- **Verdict:** ✅ APPROVE — already automated

## What We're NOT Doing
| Action | Why Rejected |
|--------|-------------|
| Extract all panels NOW | 3-4 hour refactor for zero user value; high regression risk |
| Relax the lint cap | 1947 is comfortably under 2000; headroom sufficient for several more panels |
| Split page.tsx into routes | Over-engineered; Next.js can't dynamically split a single `page.tsx` |
| Add per-panel lazy loading (`next/dynamic`) | Tier 3 item; premature optimization |

## Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Refactoring breaks the dashboard | Low (P1 touches no panel logic) | Test on slow 3G; verify no CLS regression |
| Lint rule blocks a legitimate panel addition | Low (53-line headroom) | Monitor; if tight, extract one panel before adding new one |
| Per-panel skeletons introduce layout shift | Low (skeletons match final layout) | Test each skeleton matches its panel's dimensions |

## Implementation Notes
- Start with 2-3 panels as a proof of concept
- Use existing `<Skeleton>` and `<Panel>` components from `@/components/ui/kit`
- Don't add prop drilling — use existing data flow
- Keep the monolithic `loaded` state as fallback for first paint

## Next Step
**Implement P1** (per-panel loading skeletons) — estimated 3-4 hours. This delivers the highest user-visible value with minimal risk.
