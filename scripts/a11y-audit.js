#!/usr/bin/env node
/**
 * Accessibility audit using axe-core + Playwright
 * Run: node scripts/a11y-audit.js
 */

import { chromium } from 'playwright';
import { injectAxe, checkA11y } from 'axe-playwright';

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Hermes', path: '/hermes' },
  { name: 'FreeLLM', path: '/freellm' },
  { name: 'OmniRoute', path: '/omniroute' },
];

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = [];
  
  for (const { name, path } of PAGES) {
    console.log(`\n🔍 Auditing ${name} (${path})...`);
    await page.goto(`http://localhost:8888${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    
    await injectAxe(page);
    const violations = await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
    
    if (violations.length === 0) {
      console.log(`  ✅ ${name}: No violations`);
    } else {
      console.log(`  ❌ ${name}: ${violations.length} violations`);
      for (const v of violations) {
        console.log(`    - ${v.impact}: ${v.help} (${v.nodes.length} nodes)`);
      }
    }
    results.push({ page: name, path, violations });
  }
  
  await browser.close();
  
  // Summary
  console.log('\n📊 A11y Audit Summary:');
  let totalViolations = 0;
  for (const r of results) {
    const count = r.violations.length;
    totalViolations += count;
    console.log(`  ${r.page}: ${count} violations`);
  }
  console.log(`  Total: ${totalViolations} violations`);
  
  process.exit(totalViolations > 0 ? 1 : 0);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});