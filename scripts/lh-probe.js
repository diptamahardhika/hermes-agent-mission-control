#!/usr/bin/env node
/** Quick lighthouse probe — run: node scripts/lh-probe.js */
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = join(__dirname, '..', '.lighthouse-results.json');
const child = spawn('npx', ['lighthouse', 'http://localhost:8888/', '--output=json', '--preset=desktop', '--no-ci'], {
  timeout: 120000, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
});
let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { stderr += d; });
child.on('close', () => {
  writeFileSync(outFile, stdout);
  if (stdout.includes('lighthouseResult')) {
    const json = JSON.parse(stdout);
    const a = json.audits || {};
    const perf = json.categories?.performance?.score;
    console.log('=== LIGHTHOUSE RESULTS ===');
    console.log('Performance score:', Math.round(perf * 100));
    console.log('FCP:', Math.round(a['first-contentful-paint']?.numericValue), 'ms');
    console.log('LCP:', Math.round(a['largest-contentful-paint']?.numericValue), 'ms');
    console.log('TBT:', Math.round(a['total-blocking-time']?.numericValue), 'ms');
    console.log('TTI:', Math.round(a['interactive']?.numericValue), 'ms');
    console.log('CLS:', a['cumulative-layout-shift']?.numericValue);
    console.log('Speed Index:', Math.round(a['speed-index']?.numericValue), 'ms');
    console.log('Full report: .lighthouse-results.json');
  } else {
    console.log('OUTPUT (first 500):', stdout.slice(0, 500));
    console.log('STDERR (first 500):', stderr.slice(0, 500));
  }
});