# Fix the measurement — real first-load weight gate

Status: **NOT PROCEEDING. Operator reviewed and declined, 2026-10-02.** No code was
written and none is planned. The measurements below were worth taking; the gate
they were meant to feed is not being built.

**Why, in one line:** this plan has **zero** performance impact. It removes no
bytes and makes nothing load faster. It is worth saying explicitly because the
same investigation showed 3A and 3C were sound code with a far smaller real-world
effect than their raw-byte numbers implied — and a measurement tool does not
change that.

## Decision record

Options put to the operator, with the recommendation that was given:

| Option | Description | Outcome |
|---|---|---|
| 1 | Do nothing — accept 3A/3C as shipped | **CHOSEN** |
| 2 | Fix only the misleading `MAX_HERMES_CLIENT_KB` check in `tests/tier3c-runtime.spec.ts` (~5 min) | not taken |
| 3 | Build the full first-load gate described below (~30 min) | not taken |

The recommendation was option 1. Option 2 remains a real, if minor, honesty gap:
that check reads the client-reference manifest, so it certifies `/hermes` at 87KB
while a browser downloads ~198KB. It is a false comfort rather than a false test —
it still fails correctly if the split is ever reverted.

## Laya scoring, and why it was rejected

Laya scored this plan's value highly and **was wrong**, in a way worth recording:

| Question | P(yes) | Honest read |
|---|---|---|
| Prevents falsely claiming wins | 0.910 | true, and the point |
| Catches future regressions | 0.921 | true, slowly |
| Makes the site faster for users | 0.772 | **false** |
| Reduces bytes any user downloads | 0.850 | **false** |

The plan touches no file under `src/` and removes zero bytes, so the last two
scores are wrong on their face. The model pattern-matched "performance tool" onto
"performance win" and ignored what the thing actually does — the same failure
class as the tautological deferral test caught during the 3C review: a
plausible-looking signal that cannot fail, and therefore proves nothing.

**Do not gate future decisions on Laya scores about impact.** Its scores on
*scope* were useful; its scores on *whether something helps users* were not.

## Performance status as of this decision

| | |
|---|---|
| First load, `/hermes` | 44KB HTML + 198KB JS wire + 18KB CSS wire = **260KB** |
| Irreducible shared floor | **202KB** — identical on all 20 routes |
| Route-specific code | **4–15KB** |
| JS that is React | **151KB wire = 76%** |
| 3A raw win | −15KB ≈ **0.3KB wire** |
| 3C raw win | −19KB ≈ **0.4KB wire** |

No further performance work is planned. Reopen only if a route's own weight grows
past ~30KB, or if the framework floor moves in a Next upgrade.

---

<details>
<summary>Original design (not implemented) — retained for the measurements</summary>

## The problem

Follows the Tier 3A/3C deferral work (`8627f7f`, `b42d4fd`). Those PRs are
sound code, but they were measured against a metric that does not describe what
a user downloads. This fixes the yardstick so future work is falsifiable.

## The problem

Every bundle number used to plan 3A and 3C came from
`.next/server/app/<route>/page_client-reference-manifest.js` — the chunks a route's
React client components reference.

That manifest is **not** what the browser downloads. Measured against a real
`next start` production build:

| | Route manifest said | Actually served |
|---|---|---|
| `/hermes` JS | 87KB | **650KB raw / 198KB wire** |
| `/hermes` CSS | (not counted) | **104KB raw / 18KB wire** |
| `/hermes` HTML | (not counted) | **44KB** |

The manifest omits the framework chunks every page loads — react-dom, the Next
runtime, the global stylesheet.

Consequence: 3A (−15KB) and 3C (−19KB) were real but small. Against the real
198KB wire payload they are **~0.3KB and ~0.4KB over the wire** — roughly 0.2%.
The raw-bytes numbers were not wrong, they were measuring a different thing, and
the ratio made the work look 5–7× more impactful than it is.

The gate shipped in `b42d4fd` inherits the same flaw: `MAX_HERMES_CLIENT_KB = 95`
reads the manifest, so it certifies `/hermes` at "87KB of a 95KB budget" while a
user downloads 198KB. **It cannot catch a real regression** and will never fail
for the reason it was written.

## What the real numbers are

First-load wire bytes (gzip as served), from a production `next start`:

| Route | HTML | JS | CSS | Total | Own JS |
|---|---|---|---|---|---|
| `/` | 33KB | 217KB | 18KB | 268KB | 34KB |
| `/hermes` | 44KB | 198KB | 18KB | 260KB | 15KB |
| `/articles` | 38KB | 194KB | 18KB | 250KB | 10KB |
| `/youtube` | 36KB | 193KB | 18KB | 247KB | 10KB |
| `/agents` | 34KB | 195KB | 18KB | 247KB | 11KB |
| `/garden` | 34KB | 187KB | 18KB | 239KB | 4KB |
| `/tasks` | 34KB | 188KB | 18KB | 240KB | 5KB |
| `/login` | 10KB | 193KB | 18KB | 221KB | 10KB |

Spread across every route: **47KB**.

Of the JS, three framework files are 151KB of the 198KB (76%):

| Chunk | Wire | Contents |
|---|---|---|
| `2t8yc8rnhc-rh.js` | 70KB | react-dom |
| `2-p2pymem__r7.js` | 42KB | react + Next runtime |
| `0cz1d0mv5g_q7.js` | 39KB | react |

**10 of 11 files are identical on every route: a 202KB irreducible floor.**
Route-specific code is 4–15KB. That is the only part application code can shrink,
and it is already small.

## The change

One script, `scripts/first-load-weight.mjs`, plus a CI job.

1. Build, serve the app, then for each route in a fixed list: fetch the HTML,
   extract every `/_next/static/**` `src`/`href`, fetch each, and record the
   **decompressed size when the response carried `content-encoding: gzip`**
   (falling back to a local gzip when it did not). Report HTML + JS + CSS + total
   per route, the set of files shared by all routes, and each route's own weight.
2. Emit a markdown table to stdout and a machine-readable JSON blob.
3. Fail the build when **any** route's own-JS weight exceeds its own budget, or
   when the shared floor grows by more than 10KB week over week.

### Why "own JS", not total

A total-weight budget would fail on day one for a reason nobody can act on: 202KB
is React, and React does not shrink because we changed a component. Gating the
total would train everyone to ignore the gate.

Gating each route's **own** weight isolates the part code changes. `/hermes` is
15KB because of the deferrals in 3A and 3C; `/garden` is 4KB. Those are the
numbers a contributor can actually move.

### Budgets

Set from today's measurements, with headroom for ordinary work — not from a round
number:

| Route | Own JS now | Budget |
|---|---|---|
| `/hermes` | 15KB | **24KB** |
| `/` | 34KB | **44KB** |
| `/agents` | 11KB | **20KB** |
| `/articles` | 10KB | **20KB** |
| `/youtube` | 10KB | **20KB** |
| `/login` | 10KB | **20KB** |
| all others | ≤5KB | **16KB** |
| shared floor | 202KB | **212KB** |

The shared-floor ceiling is the one that catches framework regressions, which is
exactly the class of change no route-level budget would notice.

## Files

| File | Change |
|---|---|
| `scripts/first-load-weight.mjs` | new — the measurement, no framework deps, node stdlib only |
| `scripts/__fixtures__/first-load-weight.json` | new — committed baseline so a diff shows drift |
| `.github/workflows/bundle-weight.yml` | new — build, run script, diff against baseline, fail on regression |
| `tests/first-load-weight.spec.ts` | new — asserts the script fails when a budget is exceeded (honesty probe) |
| `tests/tier3c-runtime.spec.ts` | **modify** — replace the manifest-based `MAX_HERMES_CLIENT_KB` check with a pointer to the new gate |
| `.omh/plans/tier-3c-hermes-runs-split.md` | **modify** — correct the measured-results section to state raw vs wire |

Nothing in `src/` changes. No product behaviour is touched.

## Risks

1. **Flakiness.** Network timing could make a run slow. The script measures
   response bytes, not timings, so a slow machine changes duration and not
   results. No retries needed.
2. **Server needed.** It measures a served page, so CI must run `next start`
   after `next build` — the same shape the existing smoke job already uses.
3. **Chunk hashes churn.** Budgets are in KB, not hashes, so renames do not break
   the gate. Only bytes matter.
4. **The floor may legitimately grow** with a Next upgrade. That is what the
   10KB-over-baseline allowance is for: it forces a conscious bump, not a silent
   regression.

## Verification before merge

1. `npm run build` → 0, and the script reproduces the table above on this commit.
2. `node scripts/first-load-weight.mjs` exits 0 today.
3. **Honesty probe:** raise a budget below the measured value, confirm the script
   exits non-zero and names the route, then revert byte-identically. A gate that
   cannot fail is worse than no gate.
4. Temporarily add a large component to one route, confirm its own-JS weight and
   the gate's exit code both move.
5. `npm run test` stays green with the 3C manifest check replaced.

## Laya

| Question | P(yes) | conf |
|---|---|---|
| Prune CSS (≤3KB available) | 0.542 | 0.54 |
| Switch gzip → brotli (~3KB) | 0.518 | 0.52 |
| Stop perf work entirely | 0.857 | 0.86 |

The model says stop optimising. This plan agrees and is the one thing still worth
doing: it costs ~30 minutes once, and it is what makes any future perf claim
checkable instead of self-reported.

## Recommendation (superseded — see the decision record at the top)

Build the gate, replace the misleading 95KB check, then **stop performance work**
until a route's own weight grows past its budget. Reopen only on evidence.

</details>

