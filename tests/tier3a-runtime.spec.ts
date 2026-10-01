// Runtime proof for Tier 3A: the deferred panels must actually mount when
// their tab/action fires. This drives the real UI, because the whole change is
// about client-side behaviour that a build or typecheck cannot verify.
//
// Selectors match the real markup: the /articles tabs and the editor sub-tabs
// are plain <button> elements with no ARIA role, so this addresses them by
// name rather than by role. The calendar renders a 7-column CSS grid.
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8888";
const TITLE = "3A runtime verify";

test.describe.configure({ mode: "serial" });

let articleId = "";

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${BASE}/api/articles`, {
    data: { title: TITLE, body: "temp body", track: "mega-viral", status: "draft" },
  });
  expect(res.ok()).toBeTruthy();
  articleId = (await res.json()).id;
});

test.afterAll(async ({ request }) => {
  if (!articleId) return;
  await request.delete(`${BASE}/api/articles`, { data: { id: articleId } });
});

test("articles route loads with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Compose" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Library" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendar" })).toBeVisible();

  expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("calendar tab mounts the deferred CalendarTab", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Calendar" }).click();

  // The calendar renders a 7-column week grid plus prev/today/next controls.
  // If the deferred chunk failed to load, the TabSkeleton would sit forever
  // and none of these would ever appear.
  await expect(page.getByText("Today", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".grid.grid-cols-7")).toBeVisible({ timeout: 15000 });

  // Our seeded article must appear in the calendar.
  await expect(page.getByText(TITLE)).toBeVisible({ timeout: 15000 });
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("opening an article mounts the deferred ArticleEditor", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByText(TITLE)).toBeVisible({ timeout: 15000 });

  await page.getByText(TITLE).first().click();

  // Editor-only UI. If ArticleEditor were a broken dynamic import, the modal
  // would never mount and these would time out.
  await expect(page.getByRole("button", { name: "Write" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Visuals" })).toBeVisible({ timeout: 15000 });
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("editor sub-tabs still switch after deferral", async ({ page }) => {
  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByText(TITLE).first().click();

  await expect(page.getByRole("button", { name: "Write" })).toBeVisible({ timeout: 15000 });
  // The Write tab shows the hook-tweet textarea; Visuals swaps it for the
  // planner. Switching must not unmount the editor itself.
  await expect(page.getByPlaceholder(/hook tweet/i)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Visuals" }).click();
  await expect(page.getByRole("button", { name: "Write" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Write" }).click();
  await expect(page.getByPlaceholder(/hook tweet/i)).toBeVisible({ timeout: 15000 });
});