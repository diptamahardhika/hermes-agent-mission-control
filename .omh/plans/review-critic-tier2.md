# Critic Review: Tier 2 Structural Improvements

**Date:** 2026-09-10
**Reviewer:** Critic (omh-role:critic)
**Plan:** `.omh/plans/ralplan-tier2-priorities.md`
**Architect Review:** `.omh/plans/review-architect-tier2.md`

---

## Verdict: APPROVE_WITH_RESERVATIONS

The plan is directionally correct but contains one significant underestimate and omits an important implicit benefit of P1 that strengthens its case beyond what's stated.

---

## C1: P1 Effort Underestimated — Confirmed and Deepened

The architect revised the estimate from ~2h to 3–4h. I agree and can explain *why* beyond state coordination:

**The monolithic skeleton is a maintenance time bomb.** Looking at lines 1800–1842, the skeleton is a hardcoded mirror of the grid layout. It has:
- 2 columns × 2 rows for GitHub/Homelab cards
- 2 equal-height panels (h-72)
- 1 full-width panel (h-48)
- Another single panel (h-64)
- Two small panels (h-40)
- Another h-64
- Another h-48

That's 9 skeleton blocks mirroring ~7 logical panel areas. When any panel's height changes, the skeleton must be updated manually. This is fragile by design. Per-panel skeletons don't just add loading states — they **eliminate this brittle mirror entirely**, because each panel renders its own skeleton matching its final shape. This is a second, equally important benefit that the plan doesn't articulate.

**Revised estimate: 3–4 hours.** Same as architect. Accept this revision.

---

## C2: Prioritization Is Correct — Challenge the Framing

The plan frames P1 as "structural improvement" alongside P2 (extraction). This is misleading. P1 is a **user-facing UX improvement**. The file size concern (P3) is genuinely non-actionable — 1947 < 2000 with 53-line headroom. The right framing:

| Item | What It Actually Is | Value Type |
|------|-------------------|------------|
| P1: Per-panel skeletons | UX improvement (loading states) + implicit skeleton maintenance fix | User-visible |
| P2: Extract reactively | Developer ergonomics, no user value | Internal |
| P3: Monitor lint headroom | Nothing — the guardrail works | Zero effort |

The plan's "Tier 2 Structural Improvements" title understates P1. This isn't structural — it's the highest-value user-facing item in the entire tier. It should be positioned accordingly.

---

## C3: Missing Dimensions

### Error States
The plan addresses loading but not error states. Currently, if a panel's fetch fails, it either shows nothing or stale data. Per-panel loading is the right moment to also add per-panel error handling. Each panel already has its own `useEffect` fetch — adding an `error` state is trivial and prevents silent failures.

### Accessibility
Skeleton screens are fine for loading, but the current monolithic `if (!loaded) return (<skeleton grid>)` pattern skips the entire DOM including screen reader content. Per-panel skeletons are better (panels can show their headings even while content loads), but the plan should explicitly call out that `aria-busy` or equivalent should be added.

### Bundle Size (Minor)
P2 says "extract when adding new panels." At 19 inline panels, if every one gets extracted, the import overhead becomes non-trivial. Each extracted component adds an additional chunk boundary. This isn't urgent but is worth noting — extraction should remain truly reactive, not cumulative.

---

## C4: Simplicity Test — There's an Even Simpler Path

The plan describes adding `const [panelLoaded, setPanelLoaded] = useState(true)` to each panel. But most panels already track whether their data is loaded via their data state:

```tsx
// AIModelNewsPanel already does:
const [news, setNews] = useState<AINewsData | null>(null);
// If news is null, it's loading. No extra state needed.
```

The only panels that need explicit `loading` state are those where data can be legitimately `null` (e.g., empty results). For panels like `IdeasPanel` where `boardIdeas` being undefined means "not yet fetched," the existing data state can double as the loading signal.

**Simpler approach:** Don't add a separate `loading` boolean to every panel. Use the existing data null-check pattern. Only add explicit loading state where the data model allows null as a valid state. This cuts the state machinery in half.

---

## C5: Principle Test — Minimal Disruption

✅ **Passes.** The plan explicitly rejects preemptive refactoring. P1 touches no panel logic, only rendering. P2 is deferred. The `page.tsx` file structure remains intact. The user's "dashboard works, don't break it" preference is honored.

---

## C6: The One Thing the Plan Gets Wrong

**"P3: Monitor Lint Rule Headroom" is framed as an actionable item when it requires zero action.** The lint rule is already doing its job. There's nothing to monitor — the rule will error if the cap is breached. The plan should either:
- Remove P3 entirely (it's not a task), or
- Reposition it as a footnote explaining why the lint cap is not a concern

Framing it as "P3: Monitor" implies ongoing human attention is needed when the tool already handles it.

---

## Summary of Changes Needed

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| C1 | P1 effort underestimated | Medium | Accept 3–4h estimate |
| C2 | P1 misframed as "structural" | Low | Relabel as UX improvement |
| C3 | Missing error states & a11y | Low | Add to P1 acceptance criteria |
| C4 | Unnecessarily complex loading state | Low | Reuse existing data null-checks where possible |
| C5 | Minimal disruption honored | — | No change |
| C6 | P3 is not an action item | Low | Remove or reposition |

---

## Final Assessment

The plan's core insight is correct: **the monolithic skeleton is the real problem, not the file size.** Per-panel skeletons solve both the UX gap and the skeleton maintenance debt in one pass. The reactive extraction stance is sound. The main risk is the effort underestimate, which the architect already caught.

The plan is APPROVED WITH RESERVATIONS. Implement P1 with the revised estimate and simplified loading-state approach. Defer P2 until a feature need arises. Drop P3 as a standalone item.
