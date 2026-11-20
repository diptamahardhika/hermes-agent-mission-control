export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "";

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

async function httpError(res: Response, label: string): Promise<Error> {
  let reason = `HTTP ${res.status}`;
  try {
    const e = await res.json();
    const r = e?.error?.errors?.[0]?.reason;
    if (r) reason = `${r} (HTTP ${res.status})`;
  } catch { /* non-JSON body */ }
  return new Error(`${label}: ${reason}`);
}

async function getAllVideos(ytKey: string) {
  const videos: {
    id: string;
    title: string;
    thumbnail: string;
    publishedAt: string;
    views: number;
    likes: number;
    comments: number;
    url: string;
    isShort: boolean;
    durationSecs: number;
  }[] = [];

  // Enumerate via the channel's uploads playlist, not search.list: search burns
  // the project's daily "Search Queries" quota (100 units/call) and 429s when
  // exhausted; playlistItems costs 1 unit/page and has no such cap.
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${ytKey}`,
    { next: { revalidate: 86400 } }
  );
  if (!chRes.ok) throw await httpError(chRes, "YouTube channels lookup failed");
  const chData = await chRes.json();
  const uploads: string | undefined =
    chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("YouTube channel not found or has no uploads playlist");

  let pageToken = "";
  let page = 0;

  do {
    page++;
    if (page > 10) break; // safety cap

    const listUrl =
      `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?playlistId=${uploads}&part=contentDetails&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : "") +
      `&key=${ytKey}`;

    const listRes = await fetch(listUrl, { next: { revalidate: 3600 } });
    if (!listRes.ok) {
      // First page failing means we have no data at all — surface it instead of silent zeros.
      if (page === 1) throw await httpError(listRes, "YouTube uploads list failed");
      break;
    }
    const listData = await listRes.json();

    const ids: string[] = (listData.items || [])
      .map((i: { contentDetails?: { videoId?: string } }) => i.contentDetails?.videoId)
      .filter(Boolean);

    if (ids.length > 0) {
      const statsUrl =
        `https://www.googleapis.com/youtube/v3/videos` +
        `?id=${ids.join(",")}&part=snippet,statistics,contentDetails&key=${ytKey}`;
      const statsRes = await fetch(statsUrl, { next: { revalidate: 3600 } });
      if (!statsRes.ok) {
        if (page === 1) throw await httpError(statsRes, "YouTube stats failed");
      } else {
        const statsData = await statsRes.json();
        for (const item of statsData.items || []) {
          const durationSecs = parseIsoDuration(item.contentDetails?.duration || "");
          const titleLower = (item.snippet?.title || "").toLowerCase();
          const descLower = (item.snippet?.description || "").toLowerCase();
          const hasShortTag = ["#shorts", "#short", "#youtubeshorts", "#ytshorts"].some(
            tag => titleLower.includes(tag) || descLower.includes(tag)
          );
          // Shorts: ≤180s (YouTube now allows up to 3min) OR has #shorts tag
          const isShort = (durationSecs > 0 && durationSecs <= 180) || hasShortTag;
          videos.push({
            id: item.id,
            title: item.snippet?.title || "",
            thumbnail:
              item.snippet?.thumbnails?.medium?.url ||
              `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
            publishedAt: item.snippet?.publishedAt || "",
            views: parseInt(item.statistics?.viewCount || "0", 10),
            likes: parseInt(item.statistics?.likeCount || "0", 10),
            comments: parseInt(item.statistics?.commentCount || "0", 10),
            url: `https://youtube.com/watch?v=${item.id}`,
            isShort,
            durationSecs,
          });
        }
      }
    }

    pageToken = listData.nextPageToken || "";
  } while (pageToken);

  return videos.sort((a, b) => b.views - a.views);
}

export async function GET() {
  try {
    const ytKey = process.env.YOUTUBE_API_KEY;
    if (!ytKey) {
      return NextResponse.json({
        videos: [],
        totalVideos: 0,
        avgViews: 0,
        avgEngagement: 0,
        error: "YOUTUBE_API_KEY not set",
      });
    }

    if (!CHANNEL_ID) {
      return NextResponse.json({
        videos: [],
        totalVideos: 0,
        avgViews: 0,
        avgEngagement: 0,
        error: "YOUTUBE_CHANNEL_ID not set",
      });
    }

    const videos = await getAllVideos(ytKey);
    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;
    const avgEngagement = videos.length
      ? Math.round(
          (videos.reduce(
            (s, v) =>
              s + (v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0),
            0
          ) /
            videos.length) *
            100
        ) / 100
      : 0;

    return NextResponse.json({
      videos,
      totalVideos: videos.length,
      avgViews,
      avgEngagement,
    });
  } catch (e) {
    return NextResponse.json({
      videos: [],
      totalVideos: 0,
      avgViews: 0,
      avgEngagement: 0,
      error: e instanceof Error ? e.message : "YouTube API request failed",
    });
  }
}
