import { chromium } from "@playwright/test";

const PAGES = [
  // the three pages this change touches
  ["/github", "GitHub"],
  ["/homelab", "Homelab"],
  ["/x", "X"],
  // regression guards: pages that already had an h1 must keep exactly one.
  // Titles are read from the live pages, not invented.
  ["/agents", "Your AI Team"],
  ["/tasks", "Tasks"],
  ["/ideas", "Idea Board"],
];

const browser = await chromium.launch();
let failures = 0;

for (const [path, expected] of PAGES) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`http://localhost:8888${path}`, { waitUntil: "networkidle", timeout: 45000 });

  const r = await page.evaluate(() => {
    const h1s = [...document.querySelectorAll("h1")];
    const h = h1s[0];
    const box = h?.getBoundingClientRect();
    const cs = h ? getComputedStyle(h) : null;
    return {
      h1Count: h1s.length,
      h1Text: h1s.map((x) => x.textContent.trim()),
      headings: [...document.querySelectorAll("h1,h2,h3")].map(
        (x) => `${x.tagName}:${x.textContent.trim().slice(0, 24)}`
      ),
      h1Box: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      h1Font: cs ? `${cs.fontSize}/${cs.fontWeight}` : null,
      h1Color: cs?.color ?? null,
      // is the h1 inside a hidden/clipped ancestor?
      h1Visible: (() => {
        if (!h) return false;
        const rect = h.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        let n = h;
        while (n && n !== document.body) {
          const s = getComputedStyle(n);
          if (s.visibility === "hidden" || s.display === "none") return false;
          n = n.parentElement;
        }
        return true;
      })(),
      bodyLen: document.body.innerText.trim().length,
      bodyHead: document.body.innerText.trim().slice(0, 90),
    };
  });

  const ok =
    r.h1Count === 1 &&
    r.h1Text[0] === expected &&
    r.h1Visible &&
    r.h1Box.h > 0 &&
    errors.length === 0 &&
    r.bodyLen > 200;

  if (!ok) failures++;
  console.log(`\n${ok ? "PASS" : "FAIL"} ${path}`);
  console.log(`   h1Count=${r.h1Count} text=${JSON.stringify(r.h1Text)} font=${r.h1Font} color=${r.h1Color}`);
  console.log(`   visible=${r.h1Visible} box=${JSON.stringify(r.h1Box)}`);
  console.log(`   heading order: ${r.headings.join(" | ")}`);
  console.log(`   bodyLen=${r.bodyLen} head=${JSON.stringify(r.bodyHead)}`);
  if (errors.length) console.log(`   JS ERRORS (${errors.length}): ${errors.slice(0, 3).join(" ; ")}`);

  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURES`} — ${PAGES.length} pages`);
process.exit(failures === 0 ? 0 : 1);