export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getYouTubeMetrics(url: string) {
  try {
    const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return null;
    const videoId = match[1];

    // Use YouTube Data API v3 if key available (most reliable)
    const ytKey = process.env.YOUTUBE_API_KEY;
    if (ytKey) {
      const apiRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${ytKey}`,
        { cache: "no-store" }
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        const item = data.items?.[0];
        if (item) {
          return {
            title: item.snippet?.title || "",
            thumbnail: item.snippet?.thumbnails?.maxres?.url ||
                       item.snippet?.thumbnails?.high?.url ||
                       `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            viewCount: parseInt(item.statistics?.viewCount || "0"),
            likeCount: parseInt(item.statistics?.likeCount || "0"),
            commentCount: parseInt(item.statistics?.commentCount || "0"),
          };
        }
      }
    }

    // Fallback: oEmbed for title/thumbnail + noembed for basic info
    let title = "";
    let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    let viewCount = 0;
    let likeCount = 0;

    try {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { cache: "no-store" }
      );
      if (oembed.ok) {
        const d = await oembed.json();
        title = d.title || "";
        thumbnail = d.thumbnail_url || thumbnail;
      }
    } catch { /* ok */ }

    // Try to get view count from YouTube page (parse simple patterns)
    try {
      const pageRes = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
          cache: "no-store",
        }
      );
      if (pageRes.ok) {
        const html = await pageRes.text();
        // View count appears as "viewCount\":\"12345\"
        const vcMatch = html.match(/"viewCount"\s*:\s*"(\d+)"/);
        if (vcMatch) viewCount = parseInt(vcMatch[1]);
        // Like count
        const lcMatch = html.match(/"likeCount"\s*:\s*"(\d+)"/);
        if (lcMatch) likeCount = parseInt(lcMatch[1]);
        // Title fallback
        if (!title) {
          const tMatch = html.match(/<title>([^<]+)<\/title>/);
          if (tMatch) title = tMatch[1].replace(" - YouTube", "").trim();
        }
      }
    } catch { /* ok */ }

    return { title, thumbnail, viewCount, likeCount, commentCount: 0 };
  } catch (e) {
    console.error("YouTube scrape error:", e);
    return null;
  }
}

async function getTwitterMetrics(tweetUrl: string) {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) { return null; }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4-1-fast-non-reasoning",
        tools: [{ type: "x_search" }],
        input: [{
          role: "user",
          content: `Fetch the engagement stats for this specific tweet ID: ${tweetUrl}\nReturn ONLY this JSON (no markdown, no extra text): {"views":0,"likes":0,"retweets":0,"bookmarks":0,"replies":0}`
        }]
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      await res.text();
      return null;
    }
    const data = await res.json();
    const text = data.output?.find((o: { type: string }) => o.type === "message")
      ?.content?.find((c: { type: string }) => c.type === "output_text")?.text || "";
    const jsonMatch = text.match(/\{[^{}]*\}/);
    if (!jsonMatch) { return null; }
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (e: any) {
    clearTimeout(timeout);
    console.error("[scrape-metrics] xAI fetch error:", e?.name, e?.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { youtubeUrl, tweetUrl, scriptId } = await req.json();
  const result: any = {};

  // Run both in parallel
  const [yt, twitter] = await Promise.all([
    youtubeUrl ? getYouTubeMetrics(youtubeUrl) : Promise.resolve(null),
    tweetUrl ? getTwitterMetrics(tweetUrl) : Promise.resolve(null),
  ]);

  if (yt) result.youtube = yt;
  if (twitter) result.twitter = twitter;

  // If scriptId provided, save directly to DB — no client-side PATCH needed
  if (scriptId && (yt || twitter)) {
    try {
      const updates: Record<string, unknown> = {};
      if (yt) {
        if (yt.title) updates.title = yt.title;
        if (yt.thumbnail) updates.thumbnailUrl = yt.thumbnail;
        if (yt.viewCount != null) updates.youtubeViews = yt.viewCount;
        if (yt.likeCount != null) updates.youtubeLikes = yt.likeCount;
        if (yt.commentCount != null) updates.youtubeComments = yt.commentCount;
      }
      if (twitter) {
        if (twitter.views != null) updates.tweetViews = twitter.views;
        if (twitter.likes != null) updates.tweetLikes = twitter.likes;
        if (twitter.bookmarks != null) updates.tweetBookmarks = twitter.bookmarks;
        if (twitter.retweets != null) updates.tweetRetweets = twitter.retweets;
        if (twitter.replies != null) updates.tweetReplies = twitter.replies;
      }
      if (Object.keys(updates).length > 0) {
        const saved = await prisma.longformScript.update({ where: { id: scriptId }, data: updates });
        result.saved = true;
        // Return the updated fields in result so client can update UI
        result.updatedScript = saved;
        // Silently saved
      }
    } catch (e) {
      console.error("[scrape-metrics] DB save error:", e);
      result.saveError = String(e);
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
