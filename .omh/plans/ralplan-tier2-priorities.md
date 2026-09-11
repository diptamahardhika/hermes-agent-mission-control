# Ralplan: Tier 2 Structural Improvements — Prioritized Plan

**Date:** 2026-09-10  
**Context:** Dashboard works; page.tsx is 2099 total lines (1947 effective code lines). Lint rule active, passing.

---

## Foundational Facts

- `page.tsx`: 2099 total lines, 1947 effective code lines (101 blank + 51 comment stripped)
- Lint rule `max-lines: error { max: 2000, skipBlankLines: true, skipComments: true }` is **passing** ✅
- 19 local panel functions defined inline (lines 170–1660): `IdeasPanel`, `TopTweetsPanel`, `XAnalyticsPanel`, `SpendPanel`, `OmniRoutePanel`, `FreeLLMSpendPanel`, `AIModelNewsPanel`, `GitHubHomeCard`, `HomelabHomeCard`, `AgentsStrip`, `CryptoPortfolioCard`, `SageFindingsPanel`, `ModelShareBars`, `OmniShareBars`, `TokenIOSplit`, `HistoryBuilding`, `GitHubContributionMatrix`, `FreeLLMShareBars`, `HomelabStatusBadge`
- Only `DiagnosticsStrip` and `ErrorBoundary` are extracted to separate files
- Monolithic loading skeleton (lines 1801–1842) mirrors grid structure but gives no per-panel granularity
- 0 ESLint errors, 0 TypeScript errors

---

## (META) Is "page.tsx is too big" the right problem?

**No.** The 2000-line cap is a guardrail, not an emergency. 1947 effective lines is comfortably under it with ~53 lines of headroom. The real user-facing problem is:

> **No per-panel loading states** — users see a blank or skeleton grid for ~1-2s before any panel appears, then everything loads at once.

Structural extraction is a maintainability concern, not a user-value concern. It should be driven by feature needs, not file size anxiety.

---

## Recommendations (Priority Order)

### P1: Per-Panel Loading Skeletons ⭐ HIGH VALUE, LOW EFFORT

Replace the monolithic loading skeleton (lines 1801–1842) with per-panel skeleton states. Each panel tracks its own `loading` status and renders a `<Skeleton />` from `@/components/ui/kit` matching its final layout.

- **Effort:** ~2 hours
- **User impact:** Immediate — dashboard shows progress per section, not a blank slate
- **Acceptance criteria:** Each panel shows a skeleton placeholder until its data is ready; skeleton matches final panel dimensions; no layout shift on load
- **Verdict:** ✅ APPROVE — implement first, delivers visible UX win with zero restructuring

### P2: Extract High-Cost Panels Reactively (when adding new ones)

Do not extract now. When the next panel is added (or when a panel becomes difficult to maintain), extract it to `src/components/dashboard/` and import it. Use `DiagnosticsStrip` as the pattern.

- **Effort:** ~15-30 min per extraction (done incrementally, not all at once)
- **User impact:** None (purely developer-facing)
- **Maintainability impact:** Reduces page.tsx bloat as panels accumulate; each extracted component becomes independently testable
- **Acceptance criteria:** Extracted component has same interface contract; `page.tsx` imports it; no visual regression
- **Verdict:** ✅ APPROVE — defers refactor cost until feature need justifies it

### P3: Monitor Lint Rule Headroom

Track the gap between effective line count (1947) and cap (2000). Currently ~53 lines. If a new panel would push past 2000, P2 triggers automatically.

- **Effort:** 0 (lint rule is already doing this)
- **Verdict:** ✅ APPROVE — guardrail is working, no action needed

---

## What We're NOT Doing (and Why)

| Action | Why Rejected |
|--------|-------------|
| Extract all panels NOW | 2-4 hour refactor for zero user value; dashboard works; high regression risk |
| Relax the lint cap | 1947 is comfortably under 2000; headroom is sufficient for several more panels |
| Split page.tsx into `src/app/dashboard/` chunks | Over-engineered; Next.js can't dynamically split a single `page.tsx`; would require route restructuring |
| Add per-panel lazy loading (`next/dynamic`) | Tier 3 item; premature optimization; increases complexity without clear benefit |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Refactoring breaks the dashboard | Medium (if done preemptively) | Do not refactor until P2 triggers on feature need |
| Lint rule blocks a legitimate panel addition | Low (53-line headroom) | Monitor; if tight, extract one panel before adding new one |
| Per-panel skeletons introduce layout shift | Low (skeletons match final layout) | Test on slow 3G; verify no CLS regression |

---

## Opportunity Cost

- **2 hours on P1 (skeletons):** Dashboard gets better loading UX — users see progress per panel
- **4 hours on full refactor:** Zero user-visible change; increases risk of regressions; delays other features
- **Net recommendation:** Invest 2 hours in P1, defer structural work until feature-driven

---

## Final Verdicts

| Item | Verdict |
|------|---------|
| P1: Per-panel loading skeletons | ✅ APPROVE — implement |
| P2: Extract panels reactively | ✅ APPROVE — follow pattern when needed |
| P3: Monitor lint headroom | ✅ APPROVE — already automated |
| Full preemptive refactor | ❌ REJECT — zero user value, high risk |
