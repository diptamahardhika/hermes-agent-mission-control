const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────────
const NICHES = {
  'openclaw': { label: '🦞 OpenClaw & AI Agents', queries: ['OpenClaw tutorial', 'build AI agents OpenClaw', 'run AI agents locally 2026'] },
  'polymarket-trading': { label: '📈 Polymarket & Trading Bots', queries: ['Polymarket trading bot', 'prediction market bot', 'AI trading bot build 2026'] },
  'ai-agent-build': { label: '🤖 AI Agent Builds', queries: ['build AI agent no code', 'AI automation agent tutorial', 'how to build AI employees'] },
  'agency-growth': { label: '🏢 Agency & Clients', queries: ['marketing agency growth', 'how to grow a marketing agency', 'agency owner content creator'] },
  'ai-tools': { label: '🛠️ AI for Creators', queries: ['AI tools content creators', 'AI automation marketing', 'AI replace marketing team'] },
};

const MAX_CHANNEL_SUBS = 1000000;
const MIN_OUTLIER_SCORE = 1.5;
const DAYS_AGO = 30;
const MAX_RESULTS = 15;

// ── Load API key from .env.local ────────────────────────────────────────────────
function loadApiKey() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found at', envPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('YOUTUBE_API_KEY=')) {
      const val = trimmed.slice('YOUTUBE_API_KEY='.length).trim();
      return val.replace(/^["']|["']$/g, '');
    }
  }
  console.error('ERROR: YOUTUBE_API_KEY not found in .env.local');
  process.exit(1);
}

// Add one or more YouTube Data API keys here (or via YOUTUBE_API_KEY in .env.local).
// Multiple keys are rotated when quota is hit.
const API_KEYS = [loadApiKey()].filter(Boolean);
let currentKeyIndex = 0;
function getApiKey() { return API_KEYS[currentKeyIndex]; }
function rotateKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`  ⚡ Rotated to API key ${currentKeyIndex + 1}`);
}

// ── HTTP helper ─────────────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ── ISO 8601 duration parser ────────────────────────────────────────────────────
function parseDuration(iso) {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

// ── YouTube API calls ───────────────────────────────────────────────────────────
async function searchVideos(query, publishedAfter) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=relevance&publishedAfter=${publishedAfter}&maxResults=${MAX_RESULTS}&key=${getApiKey()}`;
  const data = await fetchJSON(url);
  if (data.error) {
    if (data.error.message && data.error.message.includes('quota')) {
      rotateKey();
      const url2 = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=relevance&publishedAfter=${publishedAfter}&maxResults=${MAX_RESULTS}&key=${getApiKey()}`;
      const data2 = await fetchJSON(url2);
      if (data2.error) { console.error('  Search API error (both keys exhausted):', data2.error.message); return []; }
      return (data2.items || []).map((item) => ({ id: item.id.videoId, title: item.snippet.title, publishedAt: item.snippet.publishedAt, channelId: item.snippet.channelId, channelTitle: item.snippet.channelTitle, thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url }));
    }
    console.error('  Search API error:', data.error.message);
    return [];
  }
  return (data.items || []).map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url,
  }));
}

async function getVideoDetails(videoIds) {
  if (videoIds.length === 0) return {};
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds.join(',')}&key=${getApiKey()}`;
  const data = await fetchJSON(url);
  if (data.error) {
    console.error('  Video details API error:', data.error.message);
    return {};
  }
  const map = {};
  for (const item of (data.items || [])) {
    const dur = parseDuration(item.contentDetails.duration);
    map[item.id] = {
      views: parseInt(item.statistics.viewCount || '0', 10),
      likes: parseInt(item.statistics.likeCount || '0', 10),
      comments: parseInt(item.statistics.commentCount || '0', 10),
      duration: formatDuration(dur),
      durationSeconds: dur,
    };
  }
  return map;
}

async function getChannelInfo(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id=${channelId}&key=${getApiKey()}`;
  const data = await fetchJSON(url);
  if (data.error || !data.items || data.items.length === 0) return null;
  const ch = data.items[0];
  return {
    subs: parseInt(ch.statistics.subscriberCount || '0', 10),
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
    thumb: ch.snippet.thumbnails.default ? ch.snippet.thumbnails.default.url : '',
  };
}

async function getChannelMedianViews(uploadsPlaylistId) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=30&key=${getApiKey()}`;
  const data = await fetchJSON(url);
  if (data.error || !data.items || data.items.length === 0) return 0;
  const videoIds = data.items.map((i) => i.contentDetails.videoId);
  // Batch in groups of 50 (API limit)
  const allViews = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(',')}&key=${getApiKey()}`;
    const vData = await fetchJSON(vUrl);
    if (vData.items) {
      for (const v of vData.items) {
        allViews.push(parseInt(v.statistics.viewCount || '0', 10));
      }
    }
  }
  return median(allViews);
}

// ── Main scanner ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== YouTube Outlier Scanner ===');
  console.log(`Scanning ${Object.keys(NICHES).length} niches, ${Object.values(NICHES).reduce((s, n) => s + n.queries.length, 0)} queries total\n`);

  const publishedAfter = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000).toISOString();
  const seenIds = new Set();
  const allVideos = [];
  const nicheCounts = {};
  const channelCache = {}; // channelId -> { subs, medianViews, thumb }

  for (const [nicheKey, niche] of Object.entries(NICHES)) {
    console.log(`\n── ${niche.label} ──`);
    nicheCounts[nicheKey] = { label: niche.label, count: 0 };

    for (const query of niche.queries) {
      console.log(`  Searching: "${query}"`);

      const results = await searchVideos(query, publishedAfter);
      if (results.length === 0) { console.log('    No results'); continue; }

      // Filter already-seen
      const fresh = results.filter((v) => !seenIds.has(v.id));
      if (fresh.length === 0) { console.log('    All duplicates, skipping'); continue; }

      // Get video details
      const details = await getVideoDetails(fresh.map((v) => v.id));

      for (const video of fresh) {
        if (seenIds.has(video.id)) continue;
        const det = details[video.id];
        if (!det) continue;

        // Skip Shorts (<=90s)
        if (det.durationSeconds <= 90) continue;

        // Get/cache channel info
        if (!channelCache[video.channelId]) {
          const chInfo = await getChannelInfo(video.channelId);
          if (!chInfo) continue;
          if (chInfo.subs > MAX_CHANNEL_SUBS) {
            channelCache[video.channelId] = { subs: chInfo.subs, skip: true };
            continue;
          }
          const medViews = await getChannelMedianViews(chInfo.uploadsPlaylistId);
          channelCache[video.channelId] = { subs: chInfo.subs, medianViews: medViews, thumb: chInfo.thumb, skip: false };
        }

        const ch = channelCache[video.channelId];
        if (ch.skip) continue;
        if (ch.medianViews === 0) continue;

        const outlierScore = Math.round((det.views / ch.medianViews) * 10) / 10;
        if (outlierScore < MIN_OUTLIER_SCORE) continue;

        const daysSincePublish = Math.max(1, Math.floor((Date.now() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60 * 24)));
        const velocityScore = Math.round(det.views / daysSincePublish); // views per day

        seenIds.add(video.id);
        nicheCounts[nicheKey].count++;

        allVideos.push({
          id: video.id,
          title: video.title,
          publishedAt: video.publishedAt,
          thumbnail: video.thumbnail,
          views: det.views,
          likes: det.likes,
          comments: det.comments,
          duration: det.duration,
          durationSeconds: det.durationSeconds,
          outlierScore,
          velocityScore,
          daysSincePublish,
          niche: nicheKey,
          nicheLabel: niche.label,
          query,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          channelSubs: ch.subs,
          channelMedianViews: ch.medianViews,
          channelThumb: ch.thumb,
        });

        console.log(`    ✓ ${outlierScore}x | ${det.views.toLocaleString()} views | ${video.title.slice(0, 60)}`);
      }
    }
  }

  // Sort by outlierScore descending
  allVideos.sort((a, b) => b.outlierScore - a.outlierScore);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const output = {
    date: dateStr,
    scannedAt: now.toISOString(),
    totalOutliers: allVideos.length,
    nicheCounts,
    videos: allVideos,
  };

  // Save to data/
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const datePath = path.join(dataDir, `${dateStr}.json`);
  const latestPath = path.join(dataDir, 'latest.json');
  fs.writeFileSync(datePath, JSON.stringify(output, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));

  console.log(`\n=== Done ===`);
  console.log(`Total outliers: ${allVideos.length}`);
  console.log(`Saved to: ${datePath}`);
  console.log(`Saved to: ${latestPath}`);
  for (const [k, v] of Object.entries(nicheCounts)) {
    console.log(`  ${v.label}: ${v.count}`);
  }

  // ── Sync to Prisma DB ───────────────────────────────────────────────────────
  console.log('\n── Syncing to database…');
  try {
    const { Client } = require('pg');
    // Try .env.production.local first, then .env.local
    let dbUrl = '';
    for (const envFile of ['.env.production.local', '.env.local', '.env']) {
      const envPath = path.join(__dirname, '..', envFile);
      if (!fs.existsSync(envPath)) continue;
      const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of envLines) {
        const t = line.trim();
        if (t.startsWith('DATABASE_URL=')) {
          dbUrl = t.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
      if (dbUrl) break;
    }
const isLocal = /sslmode=disable|localhost|127\.0\.0\.1/.test(dbUrl);
    const client = new Client({ connectionString: dbUrl, ssl: isLocal ? false : { rejectUnauthorized: false } });
    await client.connect();
    const dataJson = JSON.stringify(output);
    await client.query(
      `INSERT INTO "DataStore" (key, data, "updatedAt")
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $2::jsonb, "updatedAt" = NOW()`,
      ['youtube-outliers', dataJson]
    );
    await client.end();
    console.log('✓ Database synced successfully');
  } catch (err) {
    console.error('✗ DB sync failed:', err.message);
    console.error('  (Local files still saved — run sync manually)');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
