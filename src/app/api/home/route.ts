import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HL_WALLET = process.env.HL_WALLET || ""; // legacy (unused since Binance swap)
const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || "";
const HL_API = "https://api.hyperliquid.xyz/info";
const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "";
const HERMES_KANBAN_BOARD = process.env.HERMES_BOARD || "default";

// ─── Poll-interval aligned cache (R3 upgrade) ────────────────────────────────
// These Maps survive across requests on the same Node.js process (Vercel
// serverlessInstance / local dev / PM2). A cached value is served when its
// age is under the TTL; otherwise the fetcher runs and the cache updates.
// TTLs are set to align with the client's 30s poll: 30s means "refresh with
// every poll", 60s means "refresh every other poll", 300s means "refresh
// once every 10 polls". This drops external API calls ~80–95% on a warm
// process while keeping the 30s poll responsive.

const BN_CACHE = new Map<string, { data: unknown; expires: number }>();
const YT_CACHE = new Map<string, { data: unknown; expires: number }>();
const GH_CACHE = new Map<string, { data: unknown; expires: number }>();

async function ttlFetch<T>(
  cache: Map<string, { data: T; expires: number }>,
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const existing = cache.get(key);
  if (existing && Date.now() < existing.expires) return existing.data;
  const data = await fetcher();
  cache.set(key, { data, expires: Date.now() + ttlMs });
  return data;
}

const HERMES_KANBAN_DEMO_TASKS = [
  { id: "demo-1", title: "Research Hermes outliers and keywords", assignee: "nova", status: "done", priority: 100 },
  { id: "demo-2", title: "Create Notion To Film trigger", assignee: "hermes", status: "done", priority: 95 },
  { id: "demo-3", title: "Build Kanban demo in Hermy HQ", assignee: "coding-agent", status: "running", priority: 90 },
  { id: "demo-4", title: "Write final filming script", assignee: "nova", status: "ready", priority: 85 },
  { id: "demo-5", title: "Prepare upload SEO package", assignee: "nova", status: "ready", priority: 80 },
  { id: "demo-6", title: "Design thumbnail concepts", assignee: "creative-agent", status: "ready", priority: 75 },
];

function formatHermesKanban(tasks: Array<{ id: string; title: string; assignee?: string | null; status: string; priority?: number | null; result?: string | null }>, source: "live" | "demo" = "live") {
  const counts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  return {
    board: "Hermes 24/7 Assistant Video",
    slug: HERMES_KANBAN_BOARD,
    source,
    total: tasks.length,
    counts,
    tasks: tasks
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 6)
      .map(task => ({
        id: task.id,
        title: task.title,
        assignee: task.assignee || "unassigned",
        status: task.status,
        priority: task.priority || 0,
        result: task.result ? String(task.result).slice(0, 220) : null,
      })),
  };
}

// Reads the HermesTask mirror kept in sync by the bridge on the Mac mini.
// Works on Vercel (no `hermes` binary needed); falls back to demo tasks until
// the bridge has synced at least once.
async function loadHermesKanban() {
  try {
    const tasks = await prisma.hermesTask.findMany({ orderBy: [{ priority: "desc" }], take: 50 });
    if (!tasks.length) return formatHermesKanban(HERMES_KANBAN_DEMO_TASKS, "demo");
    return formatHermesKanban(
      tasks.map(t => ({ id: t.id, title: t.title, assignee: t.assignee, status: t.status, priority: t.priority, result: t.result })),
      "live"
    );
  } catch {
    return formatHermesKanban(HERMES_KANBAN_DEMO_TASKS, "demo");
  }
}

function extractMetrics(raw: unknown) {
  if (!raw || typeof raw !== "object") return { views: 0, likes: 0, bookmarks: 0, replies: 0 };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.views === "number" || typeof obj.likes === "number") {
    return { views: Number(obj.views) || 0, likes: Number(obj.likes) || 0, bookmarks: Number(obj.bookmarks) || 0, replies: Number(obj.replies) || 0 };
  }
  let best = { views: 0, likes: 0, bookmarks: 0, replies: 0 };
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const cp = val as Record<string, unknown>;
      const v = Number(cp.views) || 0;
      if (v > best.views) {
        best = { views: v, likes: Number(cp.likes) || 0, bookmarks: Number(cp.bookmarks) || 0, replies: Number(cp.replies) || 0 };
      }
    }
  }
  return best;
}

async function hlPost(body: object) {
  const res = await fetch(HL_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  return res.json();
}

export async function GET() {
  const GITHUB_USERNAME = process.env.GITHUB_USERNAME || "";
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };

  // ─── Batch-fetch ALL DataStore keys upfront (R2c) ───────────────────────────
  // One SQL round-trip replaces everywhere the route used `findUnique`/`findMany`
  // on the generic DataStore table (pixel-ideas, polymarket-pnl, metric-snapshots,
  // homelab-monitor, hermes-cost, hermes-cost-history, x-account-stats).
  const DS_KEYS = [
    "x-account-stats", "pixel-ideas", "polymarket-pnl", "metric-snapshots",
    "homelab-monitor", "hermes-cost", "hermes-cost-history",
  ];
  let store: Record<string, unknown> = {};
  try {
    const rows = await prisma.dataStore.findMany({
      where: { key: { in: DS_KEYS } },
      select: { key: true, data: true },
    });
    store = rows.reduce<Record<string, unknown>>((acc, r) => { acc[r.key] = r.data; return acc; }, {});
  } catch { /* non-fatal — individual paths have env-var fallbacks */ }

  function normalizeGithubProfile(p: any) {
    return {
      login: p.login,
      name: p.name,
      avatarUrl: p.avatar_url ? p.avatar_url.replace("{size}", "120") : "",
      bio: p.bio,
      company: p.company,
      location: p.location,
      blog: p.blog,
      twitterUsername: p.twitter_username,
      followers: p.followers ?? 0,
      following: p.following ?? 0,
      publicRepos: p.public_repos ?? 0,
      publicGists: p.public_gists ?? 0,
      createdAt: p.created_at || "",
      updatedAt: p.updated_at || "",
      isViewer: false,
    };
  }

  // GitHub's contribution pipeline lags reality by minutes-to-hours (a merged
  // PR can take hours to register on the calendar). The REST events feed is
  // near-instant, so estimate today's contributions from it — used ONLY to
  // fill a zero day; once the calendar reports, its number wins.
  // "Working on X" — repo of the freshest push/merged PR within 14 days,
  // same live derivation as /api/github (replaces the stale GITHUB_STATUS env).
  function deriveGithubStatus(eventsResult: { status: string; value?: unknown }): string | null {
    const events = eventsResult?.status === "fulfilled" && Array.isArray(eventsResult.value)
      ? (eventsResult.value as Array<{ type?: string; created_at?: string; repo?: { name?: string } }>)
      : [];
    const cutoff = Date.now() - 14 * 86400000;
    for (const ev of events) {
      const t = new Date(ev.created_at || "").getTime();
      if (!(t >= cutoff)) continue;
      const isWork = ev.type === "PushEvent" || (ev.type === "PullRequestEvent");
      if (isWork && ev.repo?.name) {
        return `Working on ${ev.repo.name.split("/").pop()}`;
      }
    }
    return null;
  }

  function estimateRecentContributions(eventsResult: { status: string; value?: unknown }): Map<string, number> {
    const events = eventsResult?.status === "fulfilled" && Array.isArray(eventsResult.value)
      ? (eventsResult.value as Array<{ type?: string; created_at?: string; payload?: Record<string, unknown> }>)
      : [];
    // Per-day counts for the last 7 days — GitHub's calendar sometimes drops
    // whole days (observed: a merge-heavy day stayed 0 permanently), not just
    // today. The events feed covers ~90 events ≈ several days of history.
    const days = new Set([0, 1, 2, 3, 4, 5, 6].map(o => new Date(Date.now() - o * 86400000).toISOString().slice(0, 10)));
    const perDay = new Map<string, number>();
    for (const ev of events) {
      const day = (ev.created_at || "").slice(0, 10);
      if (!days.has(day)) continue;
      let n = 0;
      if (ev.type === "PushEvent") n = 1;
      else if (ev.type === "PullRequestEvent") {
        const a = ev.payload?.action;
        if (a === "opened" || a === "merged") n = 1;
      } else if (ev.type === "IssuesEvent" && ev.payload?.action === "opened") n = 1;
      else if (ev.type === "CreateEvent" && ev.payload?.ref_type === "repository") n = 1;
      if (n) perDay.set(day, (perDay.get(day) || 0) + n);
    }
    return perDay;
  }

  function buildGithubContributions(result: any, recentBoosts: Map<string, number>) {
    const col = result?.status === "fulfilled" ? result.value?.data?.user?.contributionsCollection : null;
    const cal = col?.contributionCalendar;
    if (!cal?.weeks) return null;

    const levelRank: Record<string, number> = {
      NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4,
    };

    const allDays: Array<{ date: string; count: number }> = [];
    const weeks = cal.weeks.map((w: any) => (w.contributionDays || []).map((d: any) => {
      const count = d.contributionCount || 0;
      allDays.push({ date: d.date, count });
      return { date: d.date, count, level: levelRank[d.contributionLevel] ?? (count > 0 ? 1 : 0) };
    }));

    // GitHub's calendar lags reality — and sometimes drops whole days
    // permanently (observed on a merge-heavy day). Patch any lagging cell in
    // the last week with its events-based count. Only fills zeros; once the
    // calendar reports real data, its number wins.
    let boosted = false;
    const recent = recentBoosts; // Map<string, number> of per-day event counts
    for (const [key, count] of recent) {
      const cell = allDays.find(d => d.date === key);
      if (cell && cell.count > 0) continue; // calendar already credited it
      boosted = true;
      if (cell) cell.count = count;
      for (const week of weeks) {
        const c = week.find((d: any) => d.date === key);
        if (c && c.count === 0) { c.count = count; c.level = Math.max(c.level, 1); }
      }
    }

    let currentStreak = 0;
    const dayCount = new Map(allDays.map(d => [d.date, d.count]));
    const cursor = new Date();
    for (;;) {
      const key = cursor.toISOString().slice(0, 10);
      const count = dayCount.get(key);
      if (count === undefined) { cursor.setDate(cursor.getDate() - 1); continue; }
      if (count > 0) currentStreak++;
      else break;
      cursor.setDate(cursor.getDate() - 1);
    }

    let longestStreak = 0;
    let run = 0;
    for (const d of allDays) {
      if (d.count > 0) { run++; if (run > longestStreak) longestStreak = run; }
      else run = 0;
    }

    // The day-sum matches GitHub's own profile total; the per-type counters
    // exclude some contribution types and made the number drift downward.
    // allDays already includes the patched cells, so no extra addition needed.
    const daySum = allDays.reduce((s, d) => s + d.count, 0);
    const total = daySum > 0 ? daySum : cal.totalContributions ?? 0;

    return {
      totalContributions: total,
      currentStreak,
      longestStreak,
      weeks: weeks,
    };
  }

  const githubProfileUrl = GITHUB_USERNAME
    ? `https://api.github.com/users/${GITHUB_USERNAME}`
    : null;
  const githubPinnedUrl = GITHUB_USERNAME && GITHUB_TOKEN
    ? `https://api.github.com/users/${GITHUB_USERNAME}/pinned/repos?per_page=6`
    : null;
  const githubReposUrl = GITHUB_USERNAME
    ? `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=10&type=all`
    : null;
  const githubEventsUrl = GITHUB_USERNAME && GITHUB_TOKEN
    ? `https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=100`
    : null;
  const GITHUB_CONTRIB_QUERY = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalRepositoryContributions
        }
      }
    }`;

  const [
    draftsResult,
    metricsResult,
    topPendingDraftsResult,
    hlResult,
    ytTopResult,
    ytLatestResult,
    ytChannelResult,
    xStatsRow,
    ytIdeasResult,
    hermesKanbanResult,
    githubProfileResult,
    githubPinnedResult,
    githubReposResult,
    githubEventsResult,
    githubContribResult,
  ] = await Promise.allSettled([
    prisma.draft.findMany({ where: { status: "posted" }, orderBy: { postedAt: "desc" }, take: 50 }),
    prisma.tweetMetric.findMany({ take: 500, where: { tweetId: { not: null } } }),
    prisma.draft.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" }, take: 10 }),
    // Binance PnL (swapped from Hyperliquid 2026-08-24): 1-minute TTL cache.
    // Signed SAPI calls — requires BINANCE_API_KEY / BINANCE_API_SECRET in .env.
    ttlFetch(BN_CACHE, "binance-pnl", async () => {
      if (!BINANCE_API_KEY || !BINANCE_API_SECRET) return null;
      const crypto = await import("crypto");
      const base = "https://api.binance.com";
      const call = async (path: string) => {
        const [pathname, existing] = path.split("?");
        const params = new URLSearchParams(existing || "");
        params.set("timestamp", Date.now().toString());
        params.set("recvWindow", "10000");
        const qs = params.toString();
        const signature = crypto.createHmac("sha256", BINANCE_API_SECRET).update(qs).digest("hex");
        const r = await fetch(`${base}${pathname}?${qs}&signature=${signature}`, {
          headers: { "X-MBX-APIKEY": BINANCE_API_KEY },
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`binance ${pathname} ${r.status}`);
        return r.json();
      };
      // Authoritative total: wallet/balance reports every wallet's value in BTC
      // (Earn, Trading Bots, Spot, Funding, Margin...). Convert via BTCUSDT.
      let btcTotal = 0;
      const wallets: { name: string; btc: number }[] = [];
      try {
        const wb = await call("/sapi/v1/asset/wallet/balance");
        for (const w of wb as { walletName: string; balance: string }[]) {
          const btc = parseFloat(w.balance);
          if (btc > 0) { btcTotal += btc; wallets.push({ name: w.walletName, btc }); }
        }
      } catch { /* fall back to partial data below */ }
      const btcPrice = await fetch(`${base}/api/v3/ticker/price?symbol=BTCUSDT`, { cache: "no-store" })
        .then(r => r.json()).then((p: { price: string }) => parseFloat(p.price)).catch(() => 0);
      const balance = btcTotal * btcPrice;

      // Asset-level breakdown from flexible earn positions (largest component)
      let prices: Record<string, number> = {};
      try {
        const px = await fetch(`${base}/api/v3/ticker/price`, { cache: "no-store" }).then(r2 => r2.json());
        prices = Object.fromEntries((px as { symbol: string; price: string }[]).map(p2 => [p2.symbol, parseFloat(p2.price)]));
      } catch { /* skip */ }
      const usdtValue = (asset: string, qty: number) =>
        asset === "USDT" ? qty : (prices[`${asset}USDT`] ?? 0) * qty;
      const assets: { asset: string; amount: number; usdValue: number; wallet: string }[] = [];
      try {
        const flex = await call("/sapi/v1/simple-earn/flexible/position?size=100");
        for (const row of flex.rows as { asset: string; totalAmount: string }[]) {
          const qty = parseFloat(row.totalAmount);
          if (qty <= 0) continue;
          assets.push({ asset: row.asset, amount: qty, usdValue: usdtValue(row.asset, qty), wallet: "Earn" });
        }
      } catch { /* optional */ }
      // Trading bots remainder (total minus identified)
      const identified = assets.reduce((s, a) => s + a.usdValue, 0);
      const botsValue = balance - identified;
      if (botsValue > 0.5) {
        assets.push({ asset: "Trading Bots", amount: botsValue, usdValue: botsValue, wallet: "Bots" });
      }
      assets.sort((a, b) => b.usdValue - a.usdValue);
      return { balance, assets };
    }, 60_000),
    // YouTube: 5-minute in-route TTL cache (R3b) — 3 separate Google API calls
    // per poll drop to one every 300s while warm.
    ttlFetch(YT_CACHE, "yt-top", async () =>
      fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YT_CHANNEL_ID}&maxResults=5&order=viewCount&type=video&key=${YT_API_KEY}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    300_000),
    ttlFetch(YT_CACHE, "yt-latest", async () =>
      fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YT_CHANNEL_ID}&maxResults=3&order=date&type=video&key=${YT_API_KEY}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    300_000),
    ttlFetch(YT_CACHE, "yt-channel", async () =>
      fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_CHANNEL_ID}&key=${YT_API_KEY}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    300_000),
    Promise.resolve(store["x-account-stats"] ? { data: store["x-account-stats"] } : null),
    prisma.youtubeIdea.findMany({ where: { status: { in: ["pending", "approved"] }, NOT: { status: "rejected" } }, orderBy: { createdAt: "desc" }, take: 3 }),
    Promise.resolve(loadHermesKanban()),
    // GitHub profile: 5-minute TTL (R3c) — fetches from api.github.com.
    GITHUB_USERNAME && githubProfileUrl
      ? ttlFetch(GH_CACHE, "github-profile", async () =>
          fetch(githubProfileUrl, { headers, next: { revalidate: 3600 } }).then(r => r.json()),
        300_000).then(r => r as any)
      : Promise.resolve(null),
    // GitHub pinned repos: 5-minute TTL (R3c).
    GITHUB_USERNAME && githubPinnedUrl && GITHUB_TOKEN
      ? ttlFetch(GH_CACHE, "github-pinned", async () =>
          fetch(githubPinnedUrl, { headers, next: { revalidate: 3600 } }).then(r => r.json()),
        300_000).then(r => r as any)
      : Promise.resolve(null),
    // GitHub repos: 5-minute TTL (R3c).
    GITHUB_USERNAME && githubReposUrl
      ? ttlFetch(GH_CACHE, "github-repos", async () =>
          fetch(githubReposUrl, { headers, next: { revalidate: 3600 } }).then(r => r.json()),
        300_000).then(r => r as any)
      : Promise.resolve(null),
    // GitHub events: 5-minute TTL (R3c). Events feed is near-instant, so caching
    // 5 min is safe — the contribution patching uses it only for recent-day boosts.
    GITHUB_USERNAME && githubEventsUrl && GITHUB_TOKEN
      ? ttlFetch(GH_CACHE, "github-events", async () =>
          fetch(githubEventsUrl, { headers, cache: "no-store" }).then(r => r.json()),
        300_000).then(r => r as any)
      : Promise.resolve(null),
    // GitHub GraphQL contributions: 5-minute TTL (R3c) — single GraphQL call.
    GITHUB_TOKEN
      ? ttlFetch(GH_CACHE, "github-contrib", async () =>
          fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ query: GITHUB_CONTRIB_QUERY, variables: { login: GITHUB_USERNAME } }),
            cache: "no-store",
          }).then(r => r.json()),
        300_000).then(r => r as any)
      : Promise.resolve(null),
  ]);

  // ─── X Analytics ─────────────────────────────────────────────────────────────
  const dbDrafts = draftsResult.status === "fulfilled" ? draftsResult.value : [];
  const dbMetrics = metricsResult.status === "fulfilled" ? metricsResult.value : [];
  const existingDraftIds = new Set(dbDrafts.map(d => d.id));
  const matchedTweetIds = new Set<string>();

  const tweets: { id: string; text: string; views: number; engRate: number; postedAt: Date | string | null; tweetUrl: string | null }[] = [];

  for (const d of dbDrafts) {
    const metric = dbMetrics.find(m => m.draftId === d.id || (d.tweetId && m.tweetId === d.tweetId));
    if (metric?.tweetId) matchedTweetIds.add(metric.tweetId);
    const rawMetrics = d.metrics ?? metric?.checkpoints;
    if (!rawMetrics && !d.tweetUrl) continue;
    const { views, likes, bookmarks, replies } = extractMetrics(rawMetrics);
    const engRate = views > 0 ? Math.round(((likes + bookmarks + replies) / views) * 10000) / 100 : 0;
    tweets.push({ id: d.id, text: d.text || "", views, engRate, postedAt: d.postedAt, tweetUrl: d.tweetUrl });
  }

  for (const m of dbMetrics) {
    if (!m.tweetId || matchedTweetIds.has(m.tweetId)) continue;
    if (m.draftId && existingDraftIds.has(m.draftId)) continue;
    const { views, likes, bookmarks, replies } = extractMetrics(m.checkpoints);
    if (views === 0 && likes === 0) continue;
    const engRate = views > 0 ? Math.round(((likes + bookmarks + replies) / views) * 10000) / 100 : 0;
    tweets.push({ id: m.draftId || `tweet-${m.tweetId}`, text: "", views, engRate, postedAt: m.postedAt, tweetUrl: m.url });
    matchedTweetIds.add(m.tweetId);
  }

  tweets.sort((a, b) => b.views - a.views);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tweetsThisWeek = tweets.filter(t => t.postedAt && new Date(t.postedAt as string).getTime() > weekAgo);
  const xViewsThisWeek = tweetsThisWeek.reduce((s, t) => s + t.views, 0);
  const topTweets = tweetsThisWeek.length >= 3
    ? tweetsThisWeek.slice(0, 3)
    : [...tweetsThisWeek, ...tweets.filter(t => !tweetsThisWeek.includes(t))].slice(0, 3);

  // Real 14-day X-views series (summed per calendar day) for the sparkline
  const DAY_MS = 86400000;
  const viewsByDay = new Map<string, number>();
  for (const t of tweets) {
    if (!t.postedAt || !t.views) continue;
    const key = new Date(t.postedAt as string).toISOString().slice(0, 10);
    viewsByDay.set(key, (viewsByDay.get(key) || 0) + t.views);
  }
  const xViewsTrend: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    xViewsTrend.push(viewsByDay.get(d) || 0);
  }

  const heatmap: Record<string, { sum: number; count: number }> = {};
  for (const t of tweets) {
    if (!t.postedAt || t.views === 0) continue;
    const dt = new Date(t.postedAt as string);
    const key = `${dt.getUTCDay()}-${dt.getUTCHours()}`;
    if (!heatmap[key]) heatmap[key] = { sum: 0, count: 0 };
    heatmap[key].sum += t.views;
    heatmap[key].count++;
  }
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let bestSlot = { day: 0, hour: 18, avgViews: 0 };
  for (const [key, v] of Object.entries(heatmap)) {
    const avg = v.sum / v.count;
    if (avg > bestSlot.avgViews) {
      const [day, hour] = key.split("-").map(Number);
      bestSlot = { day, hour, avgViews: avg };
    }
  }

  // Find the most recently posted tweet (tweets array is sorted by views, so we must reduce)
  const lastPosted = tweets.reduce((latest: Date | string | null, t) => {
    if (!t.postedAt) return latest;
    if (!latest) return t.postedAt;
    return new Date(t.postedAt as string).getTime() > new Date(latest as string).getTime() ? t.postedAt : latest;
  }, null);
  const daysSincePost = lastPosted ? Math.floor((Date.now() - new Date(lastPosted as string).getTime()) / 86400000) : 999;

  // ─── X account stats — live fetch + DataStore cache ───────────────────────────
  const xStatsFile = xStatsRow.status === "fulfilled" ? (xStatsRow.value?.data as any) : null;
  let liveFollowers: number | null = null;
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const xHandle = xStatsFile?.xHandle || "yourhandle";
  if (bearerToken) {
    try {
      const twitterRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${xHandle}?user.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${bearerToken}` }, cache: "no-store" }
      );
      if (twitterRes.ok) {
        const twitterData = await twitterRes.json();
        liveFollowers = twitterData.data?.public_metrics?.followers_count ?? null;
        // Update DataStore asynchronously (fire-and-forget)
        if (liveFollowers !== null) {
          prisma.dataStore.upsert({
            where: { key: "x-account-stats" },
            update: { data: { ...(xStatsFile || {}), xFollowers: liveFollowers, xHandle, xGoal: xStatsFile?.xGoal || 100000, updatedAt: new Date().toISOString() } },
            create: { key: "x-account-stats", data: { xFollowers: liveFollowers, xHandle, xGoal: 100000, updatedAt: new Date().toISOString() } },
          }).catch(() => {});

        }
      }
    } catch { /* non-fatal */ }
  }
  const xStats = {
    xFollowers: liveFollowers ?? xStatsFile?.xFollowers ?? parseInt(process.env.X_FOLLOWERS || "0"),
    xGoal: xStatsFile?.xGoal || 100000,
    xHandle,
    updatedAt: liveFollowers !== null ? new Date().toISOString() : (xStatsFile?.updatedAt || ""),
  };

  // ─── Top Sage drafts (X ideas) ───────────────────────────────────────────────
  const rawPendingDrafts = topPendingDraftsResult.status === "fulfilled" ? topPendingDraftsResult.value : [];
  const topSageDrafts = rawPendingDrafts.slice(0, 3).map(d => ({
    id: d.id,
    text: d.text?.slice(0, 140) || "",
  }));

  // ─── YouTube ideas ────────────────────────────────────────────────────────────
  const ytIdeasAll = ytIdeasResult.status === "fulfilled" ? ytIdeasResult.value : [];
  const topYoutubeIdeas = ytIdeasAll.slice(0, 3).map(i => ({ title: i.title, hook: i.hook || i.angle || "" }));

  const hermesKanban = hermesKanbanResult.status === "fulfilled" ? hermesKanbanResult.value : { board: "Hermes 24/7 Assistant Video", slug: HERMES_KANBAN_BOARD, total: 0, counts: {}, tasks: [] };

  // ─── Build ideas (Pixel) from DataStore (batched, R2c) ─────────────────────
  let topBuildIdeas: { title: string; description: string; effort: string }[] = [];
  const pixelIdeas = store["pixel-ideas"] as Array<{ title: string; description: string; effort: string; status: string }> | undefined;
  if (pixelIdeas?.length) {
    topBuildIdeas = pixelIdeas.filter(i => i.status === "pending").slice(0, 3).map(i => ({
      title: i.title,
      description: i.description?.slice(0, 100) || "",
      effort: i.effort || "medium",
    }));
  }

  // ─── YouTube ─────────────────────────────────────────────────────────────────
  type YTItem = { id?: { videoId?: string }; snippet?: { title?: string; thumbnails?: { high?: { url?: string } }; publishedAt?: string } };
  type YTResult = { items?: YTItem[] };

  let topVideo: { title: string; thumbnail: string; url: string; publishedAt: string } | null = null;
  let latestVideo: { title: string; thumbnail: string; url: string; publishedAt: string } | null = null;
  let ytSubscribers = 0;

  if (ytTopResult.status === "fulfilled") {
    const item = (ytTopResult.value as YTResult).items?.[0];
    if (item?.id?.videoId) {
      topVideo = { title: item.snippet?.title || "Top Video", thumbnail: item.snippet?.thumbnails?.high?.url || "", url: `https://youtube.com/watch?v=${item.id.videoId}`, publishedAt: item.snippet?.publishedAt || "" };
    }
  }
  if (ytLatestResult.status === "fulfilled") {
    const item = (ytLatestResult.value as YTResult).items?.[0];
    if (item?.id?.videoId) {
      latestVideo = { title: item.snippet?.title || "Latest Video", thumbnail: item.snippet?.thumbnails?.high?.url || "", url: `https://youtube.com/watch?v=${item.id.videoId}`, publishedAt: item.snippet?.publishedAt || "" };
    }
  }
  if (ytChannelResult.status === "fulfilled") {
    const ch = ytChannelResult.value as { items?: { statistics?: { subscriberCount?: string } }[] };
    ytSubscribers = parseInt(ch.items?.[0]?.statistics?.subscriberCount || "0");
  }
  if (!ytSubscribers) ytSubscribers = parseInt(process.env.YT_SUBSCRIBERS || "0");

  if (!latestVideo && process.env.YT_LATEST_VIDEO) {
    try { latestVideo = JSON.parse(process.env.YT_LATEST_VIDEO); } catch { /* ignore */ }
  }

  // ─── P&L (env var fallbacks for Vercel) ────────────────────────────────────
  let allTimePnl = parseFloat(process.env.POLY_ALL_TIME_PNL || process.env.ALL_TIME_PNL || "0");
  let todayPnl = parseFloat(process.env.POLY_TODAY_PNL || "0");
  let polyWinRate = parseFloat(process.env.POLY_WIN_RATE || "0");
  let polyTodayPnl = parseFloat(process.env.POLY_TODAY_PNL || "0");
  let polyAllTimePnl = parseFloat(process.env.POLY_ALL_TIME_PNL || "0");

  // DataStore was batch-fetched upfront (R2c); read from store.
  const polyPnl = store["polymarket-pnl"] as any;
  if (polyPnl?.allTimePnl) allTimePnl = polyPnl.allTimePnl;
  if (polyPnl?.todayPnl) todayPnl = polyPnl.todayPnl;
  if (polyPnl?.winRate) polyWinRate = polyPnl.winRate;
  if (polyPnl?.todayPnl) polyTodayPnl = polyPnl.todayPnl;
  if (polyPnl?.allTimePnl) polyAllTimePnl = polyPnl.allTimePnl;

  // ─── Binance PnL (swapped from Hyperliquid 2026-08-24) ──────────────────────
  let bnAssets: { asset: string; amount: number; usdValue: number }[] = [];
let hlBalance = 0;
  let hlPosition: { asset: string; direction: string; unrealizedPnl: number; unrealizedPnlPct: number; leverage: number; stopLoss?: number; takeProfit?: number } | null = null;

  let hlTodayPnl = parseFloat(process.env.HL_TODAY_PNL || "0");
  let hlAllTimePnl = parseFloat(process.env.HL_ALL_TIME_PNL || "0");
  // Binance realized PnL overrides env fallbacks when the API reports data
  let binanceLive = false;

  let bnRealizedToday = 0;
  let bnRealizedTotal = 0;
  if (hlResult.status === "fulfilled" && hlResult.value) {
      const bn = hlResult.value as { balance: number; assets?: { asset: string; amount: number; usdValue: number }[]; realizedToday?: number; realizedTotal?: number };
  bnAssets = bn.assets ?? [];
    hlBalance = bn.balance;
    bnRealizedToday = bn.realizedToday ?? 0;
    bnRealizedTotal = bn.realizedTotal ?? 0;
    if (bn.balance > 0 || bnRealizedTotal !== 0) {
      binanceLive = true;
      hlTodayPnl = bnRealizedToday;
      hlAllTimePnl = bnRealizedTotal;
    }
  }

  // ─── Polymarket balance (env var fallback) ──────────────────────────────────
  let polyBalance = parseFloat(process.env.POLY_BALANCE || "0");

  // ─── PM2 Processes — not available on Vercel ───────────────────────────────
  const processes: { name: string; status: string; uptime: string }[] = [];

  const hourStr = (h: number) => { const s = h >= 12 ? "PM" : "AM"; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}${s}`; };

  // ─── Daily metric snapshots (rolling history for deltas + sparklines) ────────
  // Stored in the generic DataStore (no schema migration). Honest by design:
  // history starts accumulating today; deltas render once we have 2+ days.
  // DataStore was batch-fetched upfront (R2c); read from store.
  type Snap = { d: string; xf: number; yt: number; pnl: number };
  let snapshots: Snap[] = [];
  const snapData = store["metric-snapshots"] as Snap[] | undefined;
  snapshots = Array.isArray(snapData) ? snapData : [];
  const today = new Date().toISOString().slice(0, 10);
  const point: Snap = {
    d: today,
    xf: xStats.xFollowers,
    yt: ytSubscribers,
    // Snapshot records WALLET VALUE (not PnL delta) so day-over-day deltas compute correctly.
    pnl: Math.round(hlBalance * 100) / 100,
  };
  const idx = snapshots.findIndex(s => s.d === today);
  if (idx >= 0) snapshots[idx] = point; else snapshots.push(point);
  snapshots = snapshots.slice(-60); // ~2 months of daily history
  // Drop zero-pnl legacy rows from before wallet-value snapshots existed
  snapshots = snapshots.filter(s => s.d === today || s.pnl > 0);
  prisma.dataStore.upsert({
    where: { key: "metric-snapshots" },
    update: { data: snapshots },
    create: { key: "metric-snapshots", data: snapshots },
  }).catch(() => {});
  // Binance PnL derivation (savings-style portfolio): today's PnL = wallet value
  // minus yesterday's snapshot; all-time = minus earliest snapshot.
  // PnL from snapshot history: wallet value change day-over-day / since first record.
  // Needs ≥2 days of history; before that, honest zeros.
  {
    const sortedSnaps = [...snapshots].sort((a, b) => b.d.localeCompare(a.d));
    const priorDays = sortedSnaps.filter(s => s.d !== today && s.pnl > 0);
    if (priorDays.length >= 1) {
      hlTodayPnl = Math.round((hlBalance - priorDays[0].pnl) * 100) / 100;
      const earliest = priorDays[priorDays.length - 1];
      hlAllTimePnl = Math.round((hlBalance - earliest.pnl) * 100) / 100;
    }
  }

  // ─── Homelab (mirrored into DataStore by the bridge) ─────────────────────────
  // DataStore was batch-fetched upfront (R2c); read from store.
  let homelab = {
    connected: false, checkedAt: "",
    counts: { servers: 0, serversUp: 0, services: 0, servicesUp: 0, containers: 0, runningContainers: 0 },
    system: null as {
      hostname: string; os: string; uptime: string;
      cpu_usage_percent: number; memory_used_percent: number; disk_used_percent: number;
    } | null,
  };
  const hlData = store["homelab-monitor"] as any;
  const d = hlData;
  const o = d?.overview;
  if (o) {
    const servers = Array.isArray(o.servers) ? o.servers : [];
    const services = Array.isArray(o.services) ? o.services : [];
    const containers = Array.isArray(o.containers) ? o.containers : [];
    const sys = o.system || null;
    homelab = {
      connected: true,
      checkedAt: o.checked_at || d.syncedAt || "",
      counts: {
        servers: servers.length,
        serversUp: servers.filter((s: any) => s.alive).length,
        services: services.length,
        servicesUp: services.filter((s: any) => s.status === "up").length,
        containers: containers.length,
        runningContainers: containers.filter((c: any) => c.state === "running").length,
      },
      system: sys ? {
        hostname: sys.hostname, os: sys.os, uptime: sys.uptime,
        cpu_usage_percent: sys.cpu_usage_percent ?? 0,
        memory_used_percent: sys.memory_used_percent ?? 0,
        disk_used_percent: sys.disk_used_percent ?? 0,
      } : null,
    };
  }

  // ─── Agent compute spend (mirrored by the bridge from `hermes insights`) ─────
  // DataStore was batch-fetched upfront (R2c); read from store.
  let spend: {
    syncedAt: string | null;
    totalTokens: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    sessions: number | null;
    toolCalls: number | null;
    byModel: { model: string; sessions: number; tokens: number }[];
    days: { date: string; tokens: number }[];
  } = {
    syncedAt: null, totalTokens: null, inputTokens: null, outputTokens: null,
    sessions: null, toolCalls: null, byModel: [], days: [],
  };
  const costData = store["hermes-cost"] as Record<string, unknown> | undefined;
  const histData = (store["hermes-cost-history"] as { days?: { date: string; totalTokens?: number | null }[] } | null)?.days ?? [];
  // Day-over-day deltas of the bridge's daily snapshots ≈ daily usage.
  const days = histData.map((d, i) => {
    const prev = i > 0 ? histData[i - 1] : undefined;
    const tokens =
      prev?.totalTokens != null && d.totalTokens != null
        ? Math.max(0, d.totalTokens - prev.totalTokens)
        : 0;
    return { date: d.date, tokens };
  });
  spend = {
    syncedAt: (costData?.syncedAt as string) ?? null,
    totalTokens: (costData?.totalTokens as number) ?? null,
    inputTokens: (costData?.inputTokens as number) ?? null,
    outputTokens: (costData?.outputTokens as number) ?? null,
    sessions: (costData?.sessions as number) ?? null,
    toolCalls: (costData?.toolCalls as number) ?? null,
    byModel: Array.isArray(costData?.byModel)
      ? (costData.byModel as { model: string; sessions: number; tokens: number }[])
      : [],
    days,
  };

  return NextResponse.json({
    // X
    xFollowers: xStats.xFollowers,
    xGoal: xStats.xGoal,
    xHandle: xStats.xHandle,
    topTweets,
    topTweet: topTweets[0] || null,
    xViewsThisWeek,
    totalTweets: tweets.length,
    daysSincePost,
    bestPostingDay: DAYS[bestSlot.day],
    bestPostingHourStr: hourStr(bestSlot.hour),
    xViewsTrend,
    snapshots,
    // Ideas
    topSageDrafts,
    topYoutubeIdeas,
    topBuildIdeas,
    // YouTube
    topVideo,
    latestVideo,
    ytSubscribers,
    ytGoal: 20000,
    // Trading, hard-coded for dashboard/demo display
    polyBalance,
    polyWinRate,
    polyTodayPnl,
    polyAllTimePnl,
    hlBalance,
    hlTodayPnl,
    hlAllTimePnl,
    hlPosition: null,
    hlAssets: bnAssets,
    allTimePnl: allTimePnl + hlAllTimePnl,
    todayPnl: todayPnl + hlTodayPnl,
    // GitHub
    github: {
      profile: githubProfileResult.status === "fulfilled" && githubProfileResult.value && !githubProfileResult.value.message
        ? normalizeGithubProfile(githubProfileResult.value)
        : null,
      pinnedRepos: githubPinnedResult.status === "fulfilled" && Array.isArray(githubPinnedResult.value)
        ? githubPinnedResult.value
        : [],
      recentRepos: githubReposResult.status === "fulfilled" && Array.isArray(githubReposResult.value)
        ? githubReposResult.value
        : [],
      activity: githubEventsResult.status === "fulfilled" && Array.isArray(githubEventsResult.value)
        ? githubEventsResult.value
        : null,
      status: deriveGithubStatus(githubEventsResult),
      contributions: buildGithubContributions(githubContribResult, estimateRecentContributions(githubEventsResult)),
    },
    // Homelab
    homelab,
    // Agent compute spend
    spend,
    // Legacy
    pendingDrafts: rawPendingDrafts.length,
    tweetIdeas: await prisma.idea.count({ where: { status: { notIn: ["done", "dismissed"] } } }).catch(() => 0),
    videosToFilm: await prisma.youtubeScript.count({ where: { status: { in: ["ready", "to_film", "tofilm", "approved"] } } }).catch(() => 0),
    processes,
    insight: "",
    hermesKanban,
  }, { headers: { "Cache-Control": "no-store, no-cache" } });
}
