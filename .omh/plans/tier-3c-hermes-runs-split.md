# Tier 3C — defer `HermesRuns` on `/hermes`

Status: **APPROVED AND IMPLEMENTED.** Operator approved; code in the working tree, verified, awaiting ship.

Follows the same pattern as Tier 3A (`/articles`, shipped as `8627f7f`), which took
`/articles` from 111KB to 96KB initial client JS.

## Baseline (measured on `main` @ `8627f7f`, production build)

| Route | Initial client JS |
|---|---|
| `/hermes` | **106KB** — heaviest route |
| `/agents` | 99KB |
| `/articles` | 96KB |
| `/youtube` | 90KB |

`/hermes` splits into a **53KB framework floor** (React + Next runtime, shared with
every other route) and **53KB route-unique** across 2 chunks (`2_9-2zduu_t2t.js` 47KB,
`09x1j3al_lne8.js` 5KB). Only the route-unique half is addressable.

## Target

`src/components/hermes-runs.tsx` — **929 lines**, the single largest component on the
route. It renders as the **last section** of `src/app/hermes/page.tsx`:

```
src/app/hermes/page.tsx:1039-1041
  {/* Observability — runs & usage */}
  <section id="runs" className="mt-12 scroll-mt-24">
    <HermesRuns />
  </section>
```

Everything above it (`DispatchBar`, `HermesDispatches`, approval inbox, `ActivityFeed`)
is above-the-fold content a visitor sees immediately. `HermesRuns` is a scroll-down
target reached via the `#runs` anchor — nobody needs its code to paint the page.

## Why only `HermesRuns`

| Component | Lines | Decision |
|---|---|---|
| `HermesRuns` | 929 | **Defer.** Below the fold, dominant size. |
| `HermesDispatches` | 107 | Leave. Too small to matter; deferring adds a chunk request for ~2KB of savings. |

`ActivityFeed` is defined inline in `page.tsx` and stays — it is above the fold.

## Implementation

Mirrors the 3A pattern exactly, including the three bugs 3A taught us:

1. `import dynamic from "next/dynamic"` at the top of `src/app/hermes/page.tsx`.
2. Replace the static `import { HermesRuns }` with:

```tsx
const HermesRuns = dynamic(() => import("@/components/hermes-runs").then((m) => m.HermesRuns), {
  ssr: false,
  loading: () => <Skeleton className="h-64" />,
});
```

3. The component is a **named** export (`hermes-runs.tsx:868`), so the loader must be
   `.then((m) => m.HermesRuns)`. 3A hit this exact bug.
4. `Skeleton` is already imported in `page.tsx` (used at line 1032), so `loading:`
   needs no new import.
5. **No `ssr: false`.** An earlier draft of this plan claimed it was required because
   `hermes-runs.tsx:155` reads `window.matchMedia`. That was wrong: line 155 sits inside
   the body of `usePrefersReducedMotion`'s `useEffect`, which never runs during SSR. The
   file's only browser-API reference is that one line, and nothing touches a browser API
   at module scope, so the component is SSR-safe. `ssr: false` was dropped during review
   (see "Correction found in review").

### One deliberate difference from 3A

3A gated the dynamic import behind a tab/editor state so the chunk loads when the user
acts. `/hermes` has **no such state** — `HermesRuns` renders unconditionally. So the
chunk must load on first paint of that section. It is still deferred out of the
critical path: the browser fetches it at low priority while the user reads the page
above, and it no longer blocks the initial route payload.

The honest risk: if a visitor scrolls to `#runs` immediately, they may see the skeleton
for a moment. 3A had no such case because its panels were tab-gated. This is acceptable —
the skeleton is `h-64` and the chunk is local — but it should be stated in the PR body,
not discovered in review.

## Measured result (post-implementation)

**`/hermes` initial client JS: 106KB → 87KB = −19KB / −18%.**

Predicted −25 to −40KB. Actual −19KB — missed by ~25%. Much better than 3A's 3× miss
but still wrong; the 47KB route-unique chunk held far more than `HermesRuns` alone.

Route-unique bytes fell 53KB → 34KB across the same 4 chunks.

### Deferral proven — by byte budget, not string probing

**The original string-probe evidence in this section was invalid and has been
discarded.** It claimed five markers were absent from the initial payload and
that restoring the static import put them back. Measured controls disprove it:

| Claim | Reality |
|---|---|
| `Runqueues`, `Token usage` absent | **Neither string exists in `hermes-runs.tsx` at all** (0 grep hits). They were never evidence of anything. |
| `prefers-reduced-motion`, `matchMedia`, `omniCost` absent = deferral | **Absent in both configurations.** They are client-only identifiers that live in the JS chunk, never in SSR output. |
| Restoring the static import turns the test red | **It did not.** The original test passed either way — a tautology. |

What actually distinguishes the two configurations, measured against a real
`next start` production build:

| Config | `/hermes` initial client JS | `#runs` markup in HTML |
|---|---|---|
| Static import | **106KB** across 4 chunks | present ×1 |
| `next/dynamic` | **87KB** across 4 chunks | present ×1 |

The SSR'd markup is indistinguishable, and the chunk *count* is identical. Only
total bytes differ — so that is what the test now asserts, with a 95KB ceiling
between the two measurements.

### Honesty probe (redone, and it actually goes red)

Reverting to the static import and rebuilding, then re-running the spec:

```
✘ deferred runs panel resolves to real content  → "expect(locator).toBeVisible() failed"
✘ hermes initial client JS stays under budget   → "/hermes client JS is 106KB (budget 95KB)"
2 failed
```

Both assertions are live. Restored afterwards; the tree is back to the deferred
state with `tsc 0 / lint 0 / build 0`.

### One test bug caught and fixed

The first version asserted "a new chunk arrives after first paint". `networkidle` already
waits for the deferred chunk, so recording after `goto` captured nothing and the test
failed with `saw: []`. The second version then fell into the HTML-string trap above.
The third asserts a real byte budget, which is the only signal that separates the two
configurations.

## Correction found in review

The pre-implementation plan stated `ssr: false` was **required** because
`hermes-runs.tsx:155` reads `window.matchMedia`. That justification was **wrong**.

Line 155 sits inside the body of `usePrefersReducedMotion`'s `useEffect`:

```
152: function usePrefersReducedMotion(): boolean {
153:   const [reduce, setReduce] = useState(false);
154:   useEffect(() => {
155:     const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
```

`useEffect` never runs during server rendering, so it cannot break SSR. It is also the
file's **only** browser-API reference, and nothing touches a browser API at module scope.
`HermesRuns` is therefore SSR-safe and `ssr: false` was removed.

Re-verified after removal: tsc 0, lint 0, build 0, **22/22** tests, `/hermes` still
**87KB** (unchanged). So `ssr: false` was buying nothing on this route.

Keeping `ssr: false` would also have diverged from the shipped `/articles` pattern,
where it *is* genuinely needed (3 browser-API refs, and the editor's props include
an `Article` object that must not be serialised).

## Verification results

- `npx tsc --noEmit` → 0
- `npm run lint` → exit 0
- `npm run build` → exit 0
- `npm run test` → **22/22** (20 existing + 2 new)
- Runtime tests are **DB-independent** — they never assert a clean console, per the
  PR #127 lesson that CI has no database.

## Verification before merge

1. `npx tsc --noEmit` → 0
2. `npm run lint` → exit 0
3. `npm run build` → exit 0
4. `npm run test` → 22/22
5. Re-measure `/hermes` initial JS; confirm the drop is real
6. Byte-budget test: `/hermes` initial client JS ≤ 95KB (goes red at 106KB if reverted)
7. Runtime test: navigating to `/hermes` resolves `#runs` to a rendered panel, not a
   stuck skeleton — **DB-independent**, following the PR #127 lesson. `/hermes` pulls
   from `/api/hermes/*` which reads Postgres, and CI has no database, so the test must
   assert the panel mounts, never that the console is clean.

## Laya scores

| Question | Score |
|---|---|
| Scope: `hermes_only` | **0.43 confidence** (vs `hermes_and_agents`, `skip_code`) |
| Worth it (real-user gain) | **P(yes) = 0.731**, conf 0.73 |
| Add a bundle-size CI gate | **P(yes) = 0.675**, conf 0.67 |

Scope confidence 0.43 is weak — the model is genuinely split between "hermes only" and
"also do /agents". `/hermes`-only is the recommendation on measured grounds (agents has
no equivalent 929-line below-fold component identified yet), not on model confidence.

The bundle-size gate is better deferred until this lands: a baseline should encode
post-3C numbers, not post-3A ones.

## Out of scope

- `/agents` (99KB) — needs its own measurement pass to find a target
- Bundle-size CI gate — see above
- The `smoke.yml` no-database defect — unrelated infra PR
- `readme-validator.ts` dead-module cleanup