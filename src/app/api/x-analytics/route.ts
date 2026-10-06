export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, CACHE_TTL } from "@/lib/cache";

/** Extract the latest metrics from either a flat metrics object or a checkpoints time-series */
function extractMetrics(raw: unknown): { views: number; likes: number; bookmarks: number; replies: number; retweets: number } {
  if (!raw || typeof raw !== "object") return { views: 0, likes: 0, bookmarks: 0, replies: 0, retweets: 0 };
  const obj = raw as Record<string, unknown>;

  // Flat metrics: { views, likes, bookmarks, replies, retweets }
  if (typeof obj.views === "number" || typeof obj.likes === "number") {
    return {
      views: Number(obj.views) || 0,
      likes: Number(obj.likes) || 0,
      bookmarks: Number(obj.bookmarks) || 0,
      replies: Number(obj.replies) || 0,
      retweets: Number(obj.retweets) || 0,
    };
  }

  // Checkpoints time-series: { "1h": {...}, "grok_2026-02-15": {...}, ... }
  // Pick the checkpoint with the highest views
  let best = { views: 0, likes: 0, bookmarks: 0, replies: 0, retweets: 0 };
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const cp = val as Record<string, unknown>;
      const v = Number(cp.views) || 0;
      if (v > best.views) {
        best = {
          views: v,
          likes: Number(cp.likes) || 0,
          bookmarks: Number(cp.bookmarks) || 0,
          replies: Number(cp.replies) || 0,
          retweets: Number(cp.retweets) || 0,
        };
      }
    }
  }
  return best;
}

async function getXAnalytics(req: NextRequest) {
  void req; // no query params or headers are read; signature is required by withCache
  try {
    // Fetch posted drafts
    const dbDrafts = await prisma.draft.findMany({
      where: { status: "posted" },
      orderBy: { postedAt: "desc" },
    });

    // Fetch all tweet metrics (includes external tweets not in drafts)
    const dbMetrics = await prisma.tweetMetric.findMany();
    const existingDraftIds = new Set(dbDrafts.map((d) => d.id));
    const matchedTweetIds = new Set<string>();

    const tweets: {
      id: string;
      text: string;
      views: number;
      likes: number;
      bookmarks: number;
      replies: number;
      retweets: number;
      engRate: number;
      postedAt: Date | string | null;
      tweetUrl: string | null;
    }[] = [];

    // Process drafts
    for (const d of dbDrafts) {
      // Find matching metric for this draft
      const metric = dbMetrics.find(
        (m) => m.draftId === d.id || (d.tweetId && m.tweetId === d.tweetId)
      );
      if (metric?.tweetId) matchedTweetIds.add(metric.tweetId);

      // Use draft.metrics if available, otherwise fall back to metric checkpoints
      const rawMetrics = d.metrics ?? metric?.checkpoints;
      if (!rawMetrics && !d.tweetUrl) continue; // skip if no data at all

      const { views, likes, bookmarks, replies, retweets } = extractMetrics(rawMetrics);
      const engRate =
        views > 0
          ? Math.round(((likes + bookmarks + replies) / views) * 10000) / 100
          : 0;

      tweets.push({
        id: d.id,
        text: d.text || "",
        views,
        likes,
        bookmarks,
        replies,
        retweets,
        engRate,
        postedAt: d.postedAt,
        tweetUrl: d.tweetUrl,
      });
    }

    // Add external tweets (posted directly on X, not through Hermy HQ)
    for (const m of dbMetrics) {
      if (!m.tweetId || matchedTweetIds.has(m.tweetId)) continue;
      const draftIdExists = m.draftId && existingDraftIds.has(m.draftId);
      if (draftIdExists) continue;

      const { views, likes, bookmarks, replies, retweets } = extractMetrics(m.checkpoints);
      if (views === 0 && likes === 0) continue; // skip empty entries

      const engRate =
        views > 0
          ? Math.round(((likes + bookmarks + replies) / views) * 10000) / 100
          : 0;

      tweets.push({
        id: m.draftId || `tweet-${m.tweetId}`,
        text: "",
        views,
        likes,
        bookmarks,
        replies,
        retweets,
        engRate,
        postedAt: m.postedAt,
        tweetUrl: m.url,
      });

      matchedTweetIds.add(m.tweetId);
    }

    // Sort by views desc
    tweets.sort((a, b) => b.views - a.views);

    // Build heatmap: 7 days x 24 hours
    const heatmap: Record<string, { sum: number; count: number }> = {};
    for (const t of tweets) {
      if (!t.postedAt || t.views === 0) continue;
      const dt = new Date(t.postedAt as string);
      const key = `${dt.getUTCDay()}-${dt.getUTCHours()}`;
      if (!heatmap[key]) heatmap[key] = { sum: 0, count: 0 };
      heatmap[key].sum += t.views;
      heatmap[key].count++;
    }
    const heatmapData = Object.entries(heatmap).map(([key, v]) => {
      const [day, hour] = key.split("-").map(Number);
      return {
        day,
        hour,
        avgViews: Math.round(v.sum / v.count),
        count: v.count,
      };
    });

    return NextResponse.json({ tweets, heatmap: heatmapData });
  } catch {
    return NextResponse.json({ tweets: [], heatmap: [] });
  }
}

// Uncached this handler cost ~938ms per mount (it fans out over every posted
// draft plus metric checkpoints) — the slowest polled route in the app. It is
// pure read: no writes, no auth, no query params, and nothing in this file can
// invalidate the cache, so the TTL is the only staleness bound. 60s is
// imperceptible on a tweet heatmap; the previous upstream contract for
// /api/github's PR lookup is also revalidate: 60.
const cachedGet = withCache(getXAnalytics, { ttl: CACHE_TTL.DYNAMIC });

export async function GET(req: Request) {
  return cachedGet(req as NextRequest);
}
