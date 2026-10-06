import { chromium } from "@playwright/test";

// Confirms the added h1 is the only layout change: captures each page before and
// after hiding it, so a non-zero diff means the heading actually occupies space.
const PAGES = ["/github", "/homelab", "/x"];

const browser = await chromium.launch();

for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://localhost:8888${path}`, { waitUntil: "networkidle", timeout: 45000 });

  const h1 = page.locator("h1").first();
  const text = (await h1.textContent())?.trim();
  const box = await h1.boundingBox();

  // what sits directly under the heading — should be the pre-existing content
  const nextBox = await page.evaluate(() => {
    const h = document.querySelector("h1");
    if (!h) return null;
    let n = h.nextElementSibling;
    while (n && getComputedStyle(n).position === "absolute") n = n.nextElementSibling;
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { tag: n.tagName, cls: (n.className || "").toString().slice(0, 44), y: Math.round(r.y) };
  });

  await page.screenshot({ path: `.a11y/h1-${path.slice(1)}-after.png`, fullPage: false });

  // hide the h1 and re-measure: everything below must shift up by exactly its height
  const before = await page.evaluate(() => {
    const h = document.querySelector("h1");
    const hs = h ? h.getBoundingClientRect().height + parseFloat(getComputedStyle(h).marginBottom || 0) : 0;
    return hs;
  });
  await h1.evaluate((el) => (el.style.display = "none"));
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => {
    const h = document.querySelector("h1");
    let n = h ? h.nextElementSibling : null;
    while (n && getComputedStyle(n).position === "absolute") n = n.nextElementSibling;
    return n ? Math.round(n.getBoundingClientRect().y) : null;
  });
  await page.close();

  console.log(`${path}  h1="${text}"  h=${Math.round(box.height)}px  nextSiblingShift=${after - Math.round(nextBox.y)}px (h+margin=${Math.round(before)}px)`);
  console.log(`   first content below: <${nextBox.tag}> y=${nextBox.y} cls="${nextBox.cls}"`);
}

await browser.close();