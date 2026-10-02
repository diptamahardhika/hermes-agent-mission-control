import { test, expect } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// Tier 3C: defer HermesRuns on /hermes behind next/dynamic.
//
// DB-independent by design. /hermes reads /api/hermes/* which is backed by
// Postgres, and CI runs with no database at all (the DATABASE_URL set on the
// workflow's build step never reaches the server step, and prisma/dev.db is
// gitignored). So these tests never assert "no console errors" — a broken
// database logs "Can't reach database server" regardless of deferral.
//
// WHAT PROVES DEFERRAL HERE, AND WHY THE EARLIER VERSION WAS A TAUTOLOGY
//
// An earlier version of this file asserted strings like "matchMedia" were
// absent from the served HTML. That proved nothing: they are client-only
// identifiers that live in the JS chunk, never in SSR output, so they are
// absent whether or not the split exists. Measured control, both against a real
// production build via `next start`:
//
//   static import  ->  /hermes client JS = 106KB across 4 chunks
//   next/dynamic   ->  /hermes client JS =  87KB across 4 chunks
//
// The SSR'd markup is indistinguishable either way — HermesRuns renders its
// shell server-side regardless — so no HTML substring can tell the two configs
// apart. ("Runs & usage" appears once with the static import AND once when
// deferred.) Chunk COUNT is identical too. The only thing that actually
// differs is total bytes, so that is what the second test measures.

const BASE = process.env.BASE_URL ?? "http://localhost:8888";

/**
 * Budget for /hermes' initial client JS, measured the way the bundle-size
 * numbers in .omh/plans/ are measured: sum of the uncompressed bytes of the
 * chunks in the route's client-reference manifest.
 *
 *   static import -> 106KB    next/dynamic -> 87KB
 *
 * The ceiling sits between the two, with headroom for unrelated future work on
 * this route. Raise it deliberately, never reflexively.
 */
const MAX_HERMES_CLIENT_KB = 95;

/** A literal that exists only inside hermes-runs.tsx's compiled output. */
const RUNS_PANEL_MARKER = "Top providers";

test("deferred runs panel resolves to real content, not a stuck skeleton", async ({ page }) => {
  // The assertion that actually catches a broken deferral: a failed dynamic
  // import leaves the loading skeleton up forever. Needs no database.
  await page.goto(`${BASE}/hermes`, { waitUntil: "networkidle" });

  await expect(page.locator("#runs").getByText(RUNS_PANEL_MARKER)).toBeVisible({
    timeout: 20000,
  });
});

test("hermes initial client JS stays under the deferral budget", async () => {
  // Measured off the built manifest rather than live dev chunks: `next dev`
  // serves hundreds of unbundled modules, which is not what ships.
  const manifest = await readFile(
    ".next/server/app/hermes/page_client-reference-manifest.js",
    "utf8",
  );
  const chunkPaths = [
    ...new Set(manifest.match(/\/_next\/static\/chunks\/[^"\\)]+\.js/g) ?? []),
  ];

  expect(chunkPaths.length, "expected the route to reference JS chunks").toBeGreaterThan(0);

  const sizes = await Promise.all(
    chunkPaths.map((p) => stat(path.join(".next", p.replace("/_next/", "")))),
  );
  const totalKb = Math.round(
    sizes.reduce((sum, s) => sum + s.size, 0) / 1024,
  );

  expect(
    totalKb,
    `/hermes client JS is ${totalKb}KB across ${chunkPaths.length} chunks ` +
      `(budget ${MAX_HERMES_CLIENT_KB}KB). If HermesRuns was statically ` +
      `re-imported this route returns to ~106KB.`,
  ).toBeLessThanOrEqual(MAX_HERMES_CLIENT_KB);
});