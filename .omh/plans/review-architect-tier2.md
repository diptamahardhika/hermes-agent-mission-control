# Architectural Review: Tier 2 Structural Improvements

**Date:** 2026-09-10
**Reviewer:** Architect (omh-role:architect)
**Plan:** `.omh/plans/ralplan-tier2-priorities.md`

---

## Verdict: APPROVE_WITH_RESERVATIONS

The plan is architecturally sound in direction but underestimates P1 effort and omits one risk worth noting.

---

## 1. Prioritization — Sound ✓

| Priority | Assessment |
|----------|-----------|
| P1: Per-panel skeletons | Right first step — delivers visible UX value before any restructuring |
| P2: Extract reactively | Correct — defers refactor cost until feature need justifies it |
| P3: Monitor lint headroom | Already automated; no action needed |

The "no preemptive refactor" stance is defensible. At 1947 effective lines with 53-line headroom, there's no urgency. The lint rule is the guardrail, not an emergency alarm.

---

## 2. Hidden Risks — One Not Addressed

### Per-panel loading state adds state machinery to 19 panels

The plan estimates ~2 hours for P1. This is optimistic.

**Current state:** All panels share a single `loaded` boolean. When `!loaded`, the entire grid shows the monolithic skeleton (lines 1800–1842). No per-panel state exists.

**Required change:** Each of the 19 panel functions needs its own `loading` state, initialized to `true` and set to `false` when its data arrives. This means:

- Adding `const [panelLoaded, setPanelLoaded] = useState(true)` to each panel
- Passing a `onLoad` callback or using a shared ref to signal completion
- Updating the parent's `loaded` logic to track when ALL panels are done

**The staggered reveal is a feature, not a bug:** Panels fetch at different rates. Per-panel skeletons will show a progressions (panels appear as they load) rather than a sudden full-grid reveal. This is better UX. But it requires careful state coordination.

**Revised estimate:** 3–4 hours, not 2. The complexity is in coordinating 19 independent loading states without breaking the existing data flow.

---

## 3. Loading Skeleton Approach — Correct Abstraction ✓

Using `<Skeleton>` from `@/components/ui/kit` is the right choice. It's already imported and used elsewhere. The `Panel` wrapper component is also available.

**Implementation pattern should be:**

```tsx
function IdeasPanel({ ...props }) {
  const [loading, setLoading] = useState(true);
  
  // ... fetch logic, set loading(false) when data arrives ...
  
  if (loading) {
    return <Panel><Skeleton className="h-full" /></Panel>;
  }
  
  return <Panel>...actual content...</Panel>;
}
```

The parent's `loaded` state can remain as a fallback for the very first paint (before any panel initializes), then switch to per-panel skeletons once panels mount.

---

## 4. Extraction Timing — Wait is Correct ✓

Extracting now would be:
- 2–4 hours of refactor work
- Zero user-visible change
- High regression risk (19 panels, complex interdependencies)

The reactive approach (extract when adding a new panel) is the right call. `DiagnosticsStrip` and `ErrorBoundary` are the established patterns. New panels should follow that convention.

**Trigger for P2:** When adding a new panel would push effective lines past 2000, OR when a specific panel becomes difficult to maintain in isolation.

---

## 5. Recommendations

1. **Increase P1 estimate to 3–4 hours.** The state coordination across 19 panels is non-trivial.
2. **Use a shared loading registry** to avoid prop drilling. Consider a simple context or shared ref map rather than passing callbacks through 19 panel boundaries.
3. **Keep the monolithic skeleton as fallback** for the initial paint, then switch to per-panel skeletons once panels mount. This avoids a flash of empty grid.
4. **No change to lint cap.** 53 lines of headroom is sufficient. If P1 pushes past 2000, extract one panel first.
5. **Add a note to the plan** about the staggered reveal UX benefit — this is a selling point for stakeholders.

---

## Summary

| Question | Answer |
|----------|--------|
| Does prioritization make sense? | Yes — UX win before structural work |
| Hidden dependencies/risks? | Per-panel loading state coordination across 19 panels is harder than estimated |
| Is skeleton approach right? | Yes — `<Skeleton>` + `Panel` is the correct abstraction |
| Extract now or wait? | Wait — reactive extraction is the right call |

**Verdict:** APPROVE_WITH_RESERVATIONS — plan is directionally correct; adjust P1 effort estimate and use shared loading registry to reduce coordination complexity.
