// Runtime proof for Tier 3A: the two deferred panels must actually load their
// chunk on demand. A typecheck and a build cannot verify this — only driving
// the real UI can.
//
// Two independent proofs, in order of how much they depend on external state:
//
//  1. Chunk-load observation. Records every /_next/static/chunks/*.js request
//     during initial load, then asserts that switching to the Calendar tab
//     pulls a chunk that was NOT in the initial set. This is the direct
//     signature of code splitting and needs no database at all.
//
//  2. Panel mount. Asserts the calendar grid actually renders, proving the
//     deferred chunk resolved to a working component rather than a stuck
//     skeleton.
//
// The editor tests need a saved article to open. CI runs without a database
// (prisma/dev.db is gitignored and the schema datasource is postgresql), so
// they probe first and skip with an explicit reason rather than failing or
// silently passing. They run for real on any machine with the database up.
//
// Selectors match the real markup: the /articles tabs and editor sub-tabs are
// plain <button> elements with no ARIA role, so they are addressed by name.
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
const TITLE = "3A runtime verify";

test.describe.configure({ mode: "serial" });

/** Article ids created by this spec, cleaned up afterwards. */
const created: string[] = [];

/** True when the API can actually persist an article (needs a live database). */
let dbAvailable = false;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.post(`${BASE}/api/articles`, {
      data: { title: TITLE, body: "temp body", track: "mega-viral", status: "draft" },
    });
    if (res.ok()) {
      dbAvailable = true;
      const body = await res.json();
      if (body?.id) created.push(body.id);
    }
  } catch {
    dbAvailable = false;
  }
});

test.afterAll(async ({ request }) => {
  for (const id of created) {
    await request.delete(`${BASE}/api/articles`, { data: { id } });
  }
});

test("articles route loads without deferral-related errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });

  await expect(page.getByRole("button", { name: "Compose" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Library" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendar" })).toBeVisible();

  // Only chunk-loading failures are in scope here. Console errors from the
  // data layer (e.g. "Can't reach database server") are a deployment concern,
  // not a property of the code split, and CI runs without a database at all —
  // asserting zero console errors would make this test fail for a reason that
  // has nothing to do with deferral. Each deferred panel's own mount is
  // asserted separately below, where a real chunk failure would surface as a
  // stuck skeleton and a timeout.
  const relevant = errors.filter((e) =>
    /Loading chunk|Failed to fetch|dynamically imported|ChunkLoadError|Importing a module script failed/i.test(
      e,
    ),
  );
  expect(relevant, `deferral errors: ${relevant.join(" | ")}`).toHaveLength(0);
});

test("CalendarTab chunk is not in the initial payload and loads on demand", async ({ page }) => {
  const initial = new Set<string>();
  let recording = true;

  page.on("request", (req) => {
    const url = req.url();
    if (recording && url.includes("/_next/static/chunks/") && url.endsWith(".js")) {
      initial.add(url.split("/").pop()!);
    }
  });

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  recording = false;

  // The calendar is behind a tab, so none of its code should have shipped in
  // the first-paint payload.
  const late: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/_next/static/chunks/") && url.endsWith(".js")) {
      const name = url.split("/").pop()!;
      if (!initial.has(name)) late.push(name);
    }
  });

  await page.getByRole("button", { name: "Calendar" }).click();
  await expect(page.locator(".grid.grid-cols-7")).toBeVisible({ timeout: 15000 });

  // At least one brand-new chunk had to be fetched to render the calendar.
  expect(
    late.length,
    `expected a deferred chunk to load for the calendar tab, saw: ${JSON.stringify(late)}`,
  ).toBeGreaterThan(0);
});

test("deferred calendar resolves to a working panel, not a stuck skeleton", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Calendar" }).click();

  // The calendar's own controls, not the loading skeleton. A failed dynamic
  // import leaves the skeleton up forever, so these are the real assertion.
  await expect(page.getByText("Today", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".grid.grid-cols-7")).toBeVisible({ timeout: 15000 });

  const relevant = errors.filter((e) =>
    /Loading chunk|ChunkLoadError|dynamically imported|Importing a module script failed/i.test(e),
  );
  expect(relevant, `deferral errors: ${relevant.join(" | ")}`).toHaveLength(0);
});

test("opening an article mounts the deferred ArticleEditor", async ({ page }) => {
  test.skip(!dbAvailable, "no database available; cannot create an article to open");

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText(TITLE)).toBeVisible({ timeout: 15000 });

  await page.getByText(TITLE).first().click();

  // Editor-only UI. If ArticleEditor were a broken dynamic import, the modal
  // would never mount and these would time out.
  await expect(page.getByRole("button", { name: "Write" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Visuals" })).toBeVisible({ timeout: 15000 });
});

test("editor sub-tabs still switch after deferral", async ({ page }) => {
  test.skip(!dbAvailable, "no database available; cannot create an article to open");

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByText(TITLE).first().click();

  await expect(page.getByRole("button", { name: "Write" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByPlaceholder(/hook tweet/i)).toBeVisible({ timeout: 15000 });

  // Switching must not unmount the editor itself.
  await page.getByRole("button", { name: "Visuals" }).click();
  await expect(page.getByRole("button", { name: "Write" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Write" }).click();
  await expect(page.getByPlaceholder(/hook tweet/i)).toBeVisible({ timeout: 15000 });
});