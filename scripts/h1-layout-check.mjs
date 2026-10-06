import { chromium } from "@playwright/test";

// Programmatic layout integrity for the three pages that gained an h1.
// Stronger than a screenshot: catches overlap, overflow, and clipping exactly.
const PAGES = ["/github", "/homelab", "/x"];

const browser = await chromium.launch();
let failures = 0;

for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && jsErrors.push(m.text()));

  await page.goto(`http://localhost:8888${path}`, { waitUntil: "networkidle", timeout: 45000 });

  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const h1 = document.querySelector("h1");
    const h1r = h1.getBoundingClientRect();

    // 1. horizontal overflow anywhere
    const overflowing = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > vw + 2 || b.left < -2);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${(el.className || "").toString().split(" ")[0]}`);

    // 2. does the h1 overlap the first content block?
    let n = h1.nextElementSibling;
    while (n && getComputedStyle(n).position === "absolute") n = n.nextElementSibling;
    const nr = n.getBoundingClientRect();
    const overlapPx = Math.round(Math.max(0, h1r.bottom - nr.top));

    // 3. clipped text: h1 text wider than its box
    const clipped = h1.scrollWidth > h1.clientWidth + 1;

    // 4. zero-size or invisible interactive elements introduced by the change
    const deadButtons = [...document.querySelectorAll("h1, h1 ~ * a, h1 ~ * button")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return (b.width === 0 || b.height === 0) && s.display !== "none";
      })
      .length;

    return {
      docScrollW: document.documentElement.scrollWidth,
      vw,
      h1: { text: h1.textContent.trim(), w: Math.round(h1r.width), h: Math.round(h1r.height), left: Math.round(h1r.left) },
      overflowing,
      overlapPx,
      clipped,
      deadButtons,
      contentBelow: `${n.tagName}.${(n.className || "").toString().split(" ")[0]}`,
    };
  });

  const hOverflow = r.docScrollW > r.vw + 2;
  const ok = !hOverflow && r.overflowing.length === 0 && r.overlapPx === 0 && !r.clipped && r.deadButtons === 0 && jsErrors.length === 0;
  if (!ok) failures++;

  console.log(`${ok ? "PASS" : "FAIL"} ${path}  h1="${r.h1.text}" ${r.h1.w}x${r.h1.h} @x=${r.h1.left}`);
  console.log(`   content below: <${r.contentBelow}>  overlap=${r.overlapPx}px  clipped=${r.clipped}  deadControls=${r.deadButtons}`);
  console.log(`   h-scroll: doc=${r.docScrollW} viewport=${r.vw} overflow=${hOverflow} overflowingEls=${r.overflowing.join(",") || "none"}`);
  if (jsErrors.length) console.log(`   JS ERRORS: ${jsErrors.slice(0, 3).join(" ; ")}`);

  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? "LAYOUT INTACT — 0 failures" : `${failures} FAILURES`}`);
process.exit(failures ? 1 : 0);