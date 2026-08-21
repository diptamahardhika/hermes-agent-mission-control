import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HL_WALLET = process.env.HL_WALLET || "";
const HL_API = "https://api.hyperliquid.xyz/info";
const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "";
const HERMES_KANBAN_BOARD = process.env.HERMES_BOARD || "default";

const HERMES_KANBAN_DEMO_TASKS = [
  { id: "demo-1", title: "Research Hermes outliers and keywords", assignee: "nova", status: "done", priority: 100 },
  { id: "demo-2", title: "Create Notion To Film trigger", assignee: "hermes", status: "done", priority: 95 },
  { id: "demo-3", title: "Build Kanban demo in Hermy HQ", assignee: "coding-agent", status: "running", priority: 90 },
  { id: "demo-4", title: "Write final filming script", assignee: "nova", status: "ready", priority: 85 },
  { id: "demo-5", title: "Prepare upload SEO package", assignee: "nova", status: "ready", priority: 80 },
  { id: "demo-6", title: "Design thumbnail concepts", assignee: "creative-agent", status: "ready", priority: 75 },
];

function formatHermesKanban(tasks: Array<{ id: string; title: string; assignee?: string | null; status: string; priority?: number | null }>, source: "live" | "demo" = "live") {
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
      tasks.map(t => ({ id: t.id, title: t.title, assignee: t.assignee, status: t.status, priority: t.priority })),
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
  const GITHUB_STATUS = process.env.GITHUB_STATUS || "";

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };

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

  function buildGithubContributions(result: any) {
    const col = result?.status === "fulfilled" ? result.value?.data?.user?.contributionsCollection : null;
    const cal = col?.contributionCalendar;
    if (!cal?.weeks) return null;

    // GitHub precomputes `contributionCalendar.totalContributions` and it can lag
    // the live total by a while. The per-type counters are computed fresh per
    // query, so sum those when available.
    const freshTotal =
      (col.totalCommitContributions || 0) +
      (col.totalIssueContributions || 0) +
      (col.totalPullRequestContributions || 0) +
      (col.totalPullRequestReviewContributions || 0) +
      (col.totalRepositoryContributions || 0);

    const levelRank: Record<string, number> = {
      NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4,
    };

    const allDays: Array<{ date: string; count: number }> = [];
    const weeks = cal.weeks.map((w: any) => (w.contributionDays || []).map((d: any) => {
      const count = d.contributionCount || 0;
      allDays.push({ date: d.date, count });
      return { date: d.date, count, level: levelRank[d.contributionLevel] ?? (count > 0 ? 1 : 0) };
    }));

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

    return {
      totalContributions: freshTotal > 0 ? freshTotal : cal.totalContributions ?? allDays.reduce((s, d) => s + d.count, 0),
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
    ? `https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=50`
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
    prisma.draft.findMany({ where: { status: "posted" }, orderBy: { postedAt: "desc" } }),
    prisma.tweetMetric.findMany(),
    prisma.draft.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" }, take: 10 }),
    Promise.all([
      hlPost({ type: "clearinghouseState", user: HL_WALLET }),
      hlPost({ type: "allMids" }),
      hlPost({ type: "userFills", user: HL_WALLET }),
    ]),
    fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YT_CHANNEL_ID}&maxResults=5&order=viewCount&type=video&key=${YT_API_KEY}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YT_CHANNEL_ID}&maxResults=3&order=date&type=video&key=${YT_API_KEY}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_CHANNEL_ID}&key=${YT_API_KEY}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    prisma.dataStore.findUnique({ where: { key: "x-account-stats" } }),
    prisma.youtubeIdea.findMany({ where: { status: { in: ["pending", "approved"] }, NOT: { status: "rejected" } }, orderBy: { createdAt: "desc" }, take: 3 }),
    Promise.resolve(loadHermesKanban()),
    GITHUB_USERNAME && githubProfileUrl
      ? fetch(githubProfileUrl, { headers, next: { revalidate: 3600 } }).then(r => r.json())
      : Promise.resolve(null),
    GITHUB_USERNAME && githubPinnedUrl && GITHUB_TOKEN
      ? fetch(githubPinnedUrl, { headers, next: { revalidate: 3600 } }).then(r => r.json())
      : Promise.resolve(null),
    GITHUB_USERNAME && githubReposUrl
      ? fetch(githubReposUrl, { headers, next: { revalidate: 3600 } }).then(r => r.json())
      : Promise.resolve(null),
    GITHUB_USERNAME && githubEventsUrl && GITHUB_TOKEN
      ? fetch(githubEventsUrl, { headers, next: { revalidate: 600 } }).then(r => r.json())
      : Promise.resolve(null),
    GITHUB_TOKEN
      ? fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ query: GITHUB_CONTRIB_QUERY, variables: { login: GITHUB_USERNAME } }),
          cache: "no-store",
        }).then(r => r.json())
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

  // ─── Build ideas (Pixel) from DataStore ────────────────────────────────────
  let topBuildIdeas: { title: string; description: string; effort: string }[] = [];
  try {
    const row = await prisma.dataStore.findUnique({ where: { key: "pixel-ideas" } });
    if (row?.data) {
      const ideas = row.data as Array<{ title: string; description: string; effort: string; status: string }>;
      topBuildIdeas = ideas.filter(i => i.status === "pending").slice(0, 3).map(i => ({
        title: i.title,
        description: i.description?.slice(0, 100) || "",
        effort: i.effort || "medium",
      }));
    }
  } catch { /* ignore */ }

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

  // Try DataStore for richer PnL data
  try {
    const row = await prisma.dataStore.findUnique({ where: { key: "polymarket-pnl" } });
    if (row?.data) {
      const pnl = row.data as any;
      if (pnl.allTimePnl) allTimePnl = pnl.allTimePnl;
      if (pnl.todayPnl) todayPnl = pnl.todayPnl;
      if (pnl.winRate) polyWinRate = pnl.winRate;
    }
  } catch {}

  // ─── Hyperliquid ─────────────────────────────────────────────────────────────
  let hlBalance = 0;
  let hlPosition: { asset: string; direction: string; unrealizedPnl: number; unrealizedPnlPct: number; leverage: number; stopLoss?: number; takeProfit?: number } | null = null;

  let hlTodayPnl = parseFloat(process.env.HL_TODAY_PNL || "0");
  let hlAllTimePnl = parseFloat(process.env.HL_ALL_TIME_PNL || "0");

  if (hlResult.status === "fulfilled") {
    const [accountState, allMids, fills] = hlResult.value as [any, any, Array<{ time: number; closedPnl: string }>];
    hlBalance = parseFloat(accountState.marginSummary?.accountValue || "0");
    for (const p of accountState.assetPositions || []) {
      const pos = p.position;
      if (!pos || parseFloat(pos.szi) === 0) continue;
      const size = parseFloat(pos.szi);
      const markPx = parseFloat(allMids[pos.coin] || pos.entryPx || "0");
      const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
      const leverage = parseFloat(pos.leverage?.value || pos.leverage || "1");
      const notional = Math.abs(size) * markPx;
      hlPosition = { asset: pos.coin, direction: size > 0 ? "long" : "short", unrealizedPnl, unrealizedPnlPct: notional > 0 ? (unrealizedPnl / (notional / leverage)) * 100 : 0, leverage };
    }
    if (Array.isArray(fills) && fills.length > 0) {
      const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
      hlTodayPnl = fills.filter(f => f.time > cutoffMs).reduce((s, f) => s + parseFloat(f.closedPnl || "0"), 0);
      hlAllTimePnl = fills.reduce((s, f) => s + parseFloat(f.closedPnl || "0"), 0);
    }
    try {
      const row = await prisma.battleRoyaleBot.findUnique({ where: { id: "claude-opus" } });
      if (row?.state && hlPosition) {
        const state = row.state as { current_position?: { stop_loss?: number; take_profit?: number } };
        hlPosition.stopLoss = state.current_position?.stop_loss;
        hlPosition.takeProfit = state.current_position?.take_profit;
      }
    } catch { /* ignore */ }
  }

  // ─── Polymarket balance (env var fallback) ──────────────────────────────────
  let polyBalance = parseFloat(process.env.POLY_BALANCE || "0");

  // ─── PM2 Processes — not available on Vercel ───────────────────────────────
  const processes: { name: string; status: string; uptime: string }[] = [];

  const hourStr = (h: number) => { const s = h >= 12 ? "PM" : "AM"; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}${s}`; };

  // ─── Daily metric snapshots (rolling history for deltas + sparklines) ────────
  // Stored in the generic DataStore (no schema migration). Honest by design:
  // history starts accumulating today; deltas render once we have 2+ days.
  type Snap = { d: string; xf: number; yt: number; pnl: number };
  let snapshots: Snap[] = [];
  try {
    const snapRow = await prisma.dataStore.findUnique({ where: { key: "metric-snapshots" } });
    snapshots = Array.isArray(snapRow?.data) ? (snapRow!.data as Snap[]) : [];
    const today = new Date().toISOString().slice(0, 10);
    const totalPnlNow = allTimePnl + hlAllTimePnl;
    const point: Snap = {
      d: today,
      xf: xStats.xFollowers,
      yt: ytSubscribers,
      pnl: Math.round(totalPnlNow * 100) / 100,
    };
    const idx = snapshots.findIndex(s => s.d === today);
    if (idx >= 0) snapshots[idx] = point; else snapshots.push(point);
    snapshots = snapshots.slice(-60); // ~2 months of daily history
    prisma.dataStore.upsert({
      where: { key: "metric-snapshots" },
      update: { data: snapshots },
      create: { key: "metric-snapshots", data: snapshots },
    }).catch(() => {});
  } catch { /* non-fatal */ }

  // ─── Homelab (mirrored into DataStore by the bridge) ─────────────────────────
  let homelab = {
    connected: false, checkedAt: "",
    counts: { servers: 0, serversUp: 0, services: 0, servicesUp: 0, containers: 0, runningContainers: 0 },
    system: null as {
      hostname: string; os: string; uptime: string;
      cpu_usage_percent: number; memory_used_percent: number; disk_used_percent: number;
    } | null,
  };
  try {
    const row = await prisma.dataStore.findUnique({ where: { key: "homelab-monitor" } });
    const d = row?.data as any;
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
  } catch { /* non-fatal */ }

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
    polyTodayPnl: 67.22,
    polyAllTimePnl: 67.22,
    hlBalance,
    hlTodayPnl: 0,
    hlAllTimePnl: 0,
    hlPosition: null,
    allTimePnl: 67.22,
    todayPnl: 67.22,
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
      status: GITHUB_STATUS || null,
      contributions: buildGithubContributions(githubContribResult),
    },
    // Homelab
    homelab,
    // Legacy
    pendingDrafts: rawPendingDrafts.length,
    tweetIdeas: await prisma.idea.count({ where: { status: { notIn: ["done", "dismissed"] } } }).catch(() => 0),
    videosToFilm: await prisma.youtubeScript.count({ where: { status: { in: ["ready", "to_film", "tofilm", "approved"] } } }).catch(() => 0),
    processes,
    insight: "",
  }, { headers: { "Cache-Control": "no-store, no-cache" } });
}
