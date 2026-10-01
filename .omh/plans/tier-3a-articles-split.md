# Tier 3A — Route-level code splitting on `/articles`

**Status:** DESIGN ONLY. Nothing implemented. Awaiting operator approval per the
workflow-discipline mandate in `AGENTS.md`.

## What the numbers actually say

Measured from a production build (`npm run build`), decomposing each route's
client chunks into *shared baseline* vs *route-unique*:

| Route | Total client JS | Shared 53KB baseline | Route-unique | `next/dynamic` can defer? |
|---|---|---|---|---|
| `/articles` | **111KB** | 53KB | **58KB** | **yes — biggest prize** |
| `/youtube` | 90KB | 53KB | 37KB | partially, already done |
| `/x` | 60KB | 53KB | **7KB** | **no — pointless** |
| `/longform` | 87KB | 53KB | 34KB | yes, but a separate route |
| `/x-content` | 86KB | 53KB | 33KB | yes, already deferred by `/x` |

**The 53KB baseline is React + Next runtime.** It appears in all 15 routes and no
amount of `next/dynamic` touches it. That is the ceiling on this technique.

## Two findings that change the original plan

**1. Tier 3A is already ~half built.** `next/dynamic` is live in three places
with an established pattern:

- `src/app/page.tsx:33-36` — four below-fold homepage panels, deferred parse
- `src/app/youtube/page.tsx:22-23` — `LongformTab`, `OutlierFeed`
- `src/app/x/page.tsx:30-32` — three sub-route tabs

All five use `{ ssr: false, loading: () => <TabSkeleton /> }`. This is copy-paste
work with a known-good template, not novel architecture.

**2. The plan named the wrong target for `/x`.** Tier 3A proposed `/articles`,
`/youtube`, `/x` together. Measured: `/x` has only **7KB** of route-unique code —
deferring it saves almost nothing while adding a loading state to a tab. The real
prize is `/articles` at **58KB unique**. `/youtube`'s remaining 37KB is partly
already deferred.

## Recommended scope: `/articles` only

Laya scored the options on the real measurements:
- `best_target` → **`articles_only`** (confidence 0.345 — weak, so this is a
  judgement call supported by the byte counts, not an oracle)
- `worth_the_time` P(yes) = **0.885** — worth doing
- `risk_of_tab_defer` P(yes) = **0.284** — visible jank unlikely
- `needs_bundle_budget_first` P(yes) = **0.49** — genuinely split

## The change

Two components in `src/app/articles/page.tsx` are already behind conditionals:

- `CalendarTab` — rendered only when `tab === "calendar"` (line 477)
- `ArticleEditor` — rendered only when `editingArticle` is truthy (line 1236)

Both are perfect `next/dynamic` candidates: unreachable on first paint, and their
chunk leaves the initial payload.

```tsx
const CalendarTab = dynamic(() => import("@/components/articles/calendar-tab"), {
  ssr: false,
  loading: () => <TabSkeleton />,
});
const ArticleEditor = dynamic(() => import("@/components/articles/article-editor"), {
  ssr: false,
  loading: () => <TabSkeleton />,
});
```

`TabSkeleton` already exists and is already used by `/youtube` and `/x`.

### `ssr: false` — justified, with evidence

| Component | `window`/`document`/`localStorage` refs | Verdict |
|---|---|---|
| `calendar-tab.tsx` | **0** | SSR-safe; `ssr: false` optional |
| `article-editor.tsx` | **3** | `ssr: false` correct |

For the calendar, `ssr: false` is a deliberate *consistency* choice matching the
repo's existing tab pattern, not a technical requirement. That distinction is
recorded here so a future reader does not "optimise" it into an inconsistency
without knowing the tradeoff was considered.

## Measured result (post-implementation)

**The estimate above was wrong.** Chunk analysis predicted 111KB → ~53–56KB.
The actual measured result:

| Metric | Before | After | Delta |
|---|---|---|---|
| `/articles` initial client JS | 111KB (4 chunks) | **96KB** (4 chunks) | **−15KB (−14%)** |

Only 15KB deferred, not 55KB. Why the estimate failed: the "55KB route-unique"
chunk was not purely the two deferred components. `page.tsx` itself is ~1500
lines of tab/compose/library UI that stays in the initial payload regardless, and
the editor shares code (`heroImageUrl`, `bookmarks`, `impressions`, `QT Tweet`
are `Article` fields used by the library table too).

Deferral verified by string-probing the initial payload:
- **Deferred (absent from initial):** `Analyze Article`, `Plan Visuals`,
  `Save Changes`, `handleDrop`, `dragover`
- **Still initial (expected):** `heroImageUrl`, `bookmarks`, `impressions` —
  shared `Article` fields, not editor-only code

The old 55KB chunk `1so_60wjaxgl6.js` no longer exists, replaced by
`42caaez2he_tq.js` (42KB) plus deferred chunks. The mechanism works; the win is
smaller than predicted.

**Honest verdict: real but modest — 14%, not 50%.** The 53KB framework floor
plus ~42KB of `page.tsx`'s own first-paint UI dominates. Rejecting `/x` (7KB)
was even more clearly right than predicted.

## Verification results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test` | **19/19** (15 existing + 4 new) |
| Re-measured `/articles` chunks | 111KB → **96KB**, deferral confirmed |
| Runtime: calendar mounts | pass |
| Runtime: editor modal mounts | pass |
| Runtime: editor sub-tabs switch | pass |
| Test data cleanup | `/api/articles` → `[]` |

Two implementation bugs were caught during the work and fixed:

1. `dynamic()` infers `{}` for props — the existing `/youtube` and `/x` patterns
   never hit this because they import prop-less pages. Fixed with explicit
   generics. Prop types are declared locally in `page.tsx` rather than exported
   from the components, to avoid widening their public surface.
2. Both components are **named** exports, not default. The loader must be
   `import(...).then((m) => m.CalendarTab)`; a bare import silently type-errors.

A third issue was a test-authoring error worth recording: the first version of
the runtime spec assumed ARIA `role="tab"` and `role="grid"`. The real `/articles`
markup uses plain `<button>` elements with no ARIA roles. The spec was corrected
to match the actual DOM.

## Risks

1. **Layout shift on tab switch.** Deferred chunk loads on first tab click.
   Mitigated by `loading: () => <TabSkeleton />` at a fixed height. Must verify
   CLS does not regress.
2. **`ssr: false` and hydration.** Both components are already conditionally
   rendered, so neither is in the initial HTML today. Low risk, but the modal
   (`ArticleEditor`) opens on user action — confirm no focus trap regression.
   The repo has prior art here: PR #121 fixed agent-modal focus handling.
3. **Accessibility.** A dynamically loaded tab panel must keep its ARIA
   wiring. `AccessibleTabList` (`src/components/accessible-tabs.tsx`) manages
   `aria-selected` and arrow-key focus. A suspended panel must not break focus
   movement — the existing a11y CI job must stay green.

## Verification gate — required before merge

Every one of these must be re-run, and none may be skipped:

1. `npx tsc --noEmit` → exit 0
2. `npm run lint` → exit 0 (this is now a real merge gate after PR #126)
3. `npm run build` → exit 0
4. `npm run test` → 15/15
5. **Re-measure `/articles` chunks** — prove the unique chunk actually split
6. **Runtime:** `/articles` → click Calendar tab → click Library → open an
   article editor. Confirm all three render, no console errors.
7. **Lighthouse on `/articles`** before/after — the actual perf number
8. **a11y CI green** — tab panel ARIA intact
9. Compare against the **clean-room CI simulation** used in PR #126

## Explicitly out of scope

- **`/x`** — 7KB unique. Measured and rejected.
- **The 53KB shared baseline** — React/Next runtime. `next/dynamic` cannot touch it.
- **A bundle budget gate (Tier 3B)** — previously scored P(yes)=0.087 and
  skipped. Laya now says 0.49, i.e. genuinely undecided. Worth revisiting *after*
  this change lands, so there is a real baseline to hold.
- **`readme-validator.ts` move out of `src/`** — separate cleanup.

## Open question for the operator

Laya is genuinely split on whether to add a bundle budget gate **before** this
work (0.49). Two defensible orders:

- **Ship 3A first, budget after** — you get the win, then lock it in with a
  budget measured against the improved baseline.
- **Budget first** — nothing can silently regress while you do the work.

Recommendation: **ship 3A first.** The change is small, reversible, and behind an
existing proven pattern; a budget gate designed against the *current* baseline
would encode the pre-optimisation numbers as acceptable.

---

## Verdict

**Proceed, pending approval.** Risk **low**, effort **~45 minutes**, pattern
already proven in this repo. Performance gain is real but bounded: ~58KB off
first paint on one route, against a 53KB framework floor that no amount of
splitting removes.

**Next action:** approve or amend the scope. Nothing has been written to the
working tree.