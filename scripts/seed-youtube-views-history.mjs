// One-off seed: derive daily channel views from the yt-analytics CSV snapshots
// (per-video cumulative viewCounts) and store them in DataStore key
// `youtube-views-history`. The home route appends today's point automatically
// from the stats it already fetches — re-running this seed replaces the array,
// and the next /api/home poll re-appends today.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Load .env so Prisma has DATABASE_URL before client init.
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const { PrismaClient } = require('@prisma/client');

const CSV = '/Users/pradiptamahardika/Youtube Cliping/analytics/views-history.csv';
const rows = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
const byDate = {};
for (const p of rows) {
  const d = p[0];
  const views = parseInt(p[p.length - 3], 10); // titles contain commas — parse from the end
  if (!Number.isFinite(views)) continue;
  byDate[d] = (byDate[d] || 0) + views;
}
const dates = Object.keys(byDate).sort();
const points = [];
let prev = null;
for (const d of dates) {
  const total = byDate[d];
  // First snapshot has no prior day — no honest delta, skip it.
  if (prev !== null) points.push({ d, views: Math.max(0, total - prev), total });
  prev = total;
}

const prisma = new PrismaClient();
await prisma.dataStore.upsert({
  where: { key: 'youtube-views-history' },
  update: { data: points },
  create: { key: 'youtube-views-history', data: points },
});
console.log(`seeded ${points.length} daily points (${points[0]?.d} -> ${points[points.length - 1]?.d}), sum of deltas ${points.reduce((s, p) => s + p.views, 0)}`);
await prisma.$disconnect();