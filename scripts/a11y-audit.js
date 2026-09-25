#!/usr/bin/env node
/**
 * Accessibility audit using axe-core + Playwright.
 * Run: npm run a11y
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8888').replace(/\/$/, '');
const REPORT_PATH = resolve(process.env.A11Y_REPORT_PATH ?? '.a11y/a11y-report.json');
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Hermes', path: '/hermes' },
  { name: 'Agents', path: '/agents' },
  { name: 'Tasks', path: '/tasks' },
  { name: 'Ideas', path: '/ideas' },
  { name: 'GitHub', path: '/github' },
  { name: 'Homelab', path: '/homelab' },
  { name: 'X', path: '/x' },
  { name: 'YouTube', path: '/youtube' },
  { name: 'Articles', path: '/articles' },
];

function blockingViolations(results) {
  return results.flatMap(({ page, path, violations }) =>
    violations
      .filter(({ impact }) => BLOCKING_IMPACTS.has(impact))
      .map((violation) => ({ page, path, violation })),
  );
}

function buildReport(results, error = null) {
  const blocking = blockingViolations(results);
  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    status: error ? 'error' : blocking.length > 0 ? 'fail' : 'pass',
    blockingImpacts: [...BLOCKING_IMPACTS],
    error,
    summary: {
      pagesExpected: PAGES.length,
      pagesAudited: results.length,
      violations: results.reduce((total, result) => total + result.violations.length, 0),
      blocking: blocking.length,
    },
    results,
  };
}

async function writeReport(report) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function runAudit() {
  const results = [];
  let browser;
  let auditError = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const { name, path } of PAGES) {
      const url = `${BASE_URL}${path}`;
      console.log(`\nAuditing ${name} (${path})...`);

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      if (!response) throw new Error(`${name} returned no response: ${url}`);
      if (!response.ok()) throw new Error(`${name} returned HTTP ${response.status()}: ${url}`);

      const redirectedFrom = response.request().redirectedFrom();
      if (redirectedFrom) {
        throw new Error(
          `${name} redirected from ${redirectedFrom.url()} to ${response.url()}: ${url}`,
        );
      }

      await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
          html { scroll-behavior: auto !important; }
        `,
      });
      // The dashboard polls several APIs. Wait long enough for first data paint,
      // but do not use networkidle: WebSocket/SSE traffic prevents it settling.
      await page.waitForTimeout(1_000);

      const audit = await new AxeBuilder({ page }).analyze();
      const violations = audit.violations;
      const pageBlocking = violations.filter(({ impact }) =>
        BLOCKING_IMPACTS.has(impact),
      ).length;
      const status = violations.length === 0 ? 'PASS' : pageBlocking > 0 ? 'FAIL' : 'WARN';

      console.log(`  ${status}: ${violations.length} violations`);
      for (const violation of violations) {
        const blocking = BLOCKING_IMPACTS.has(violation.impact)
          ? ' [BLOCKING]'
          : ' [NON-BLOCKING]';
        console.log(
          `    - ${violation.impact}: ${violation.help} (${violation.nodes.length} nodes)${blocking}`,
        );
      }

      results.push({ page: name, path, status, violations });
    }
  } catch (error) {
    auditError = error instanceof Error ? error.message : String(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await writeReport(buildReport(results, auditError));
  }

  console.log('\nA11y Audit Summary:');
  for (const result of results) {
    const pageBlocking = result.violations.filter(({ impact }) =>
      BLOCKING_IMPACTS.has(impact),
    ).length;
    console.log(
      `  ${result.page}: ${result.status}, ${result.violations.length} violations, ${pageBlocking} blocking`,
    );
  }
  console.log(`  Report: ${REPORT_PATH}`);

  if (auditError) {
    console.error(`Audit failed: ${auditError}`);
    process.exitCode = 1;
    return;
  }

  const blocking = blockingViolations(results);
  if (blocking.length > 0) {
    console.error(`Blocking accessibility violations: ${blocking.length}`);
    process.exitCode = 1;
  }
}

runAudit().catch((error) => {
  console.error('Audit failed:', error);
  process.exitCode = 1;
});
