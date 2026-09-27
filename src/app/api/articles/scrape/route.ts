export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { fetchUrlContent } from "@/lib/fetch-url-content";
import { errorMessage } from "@/lib/errors";

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Minimal shapes of the Twitter/X API v2 responses used below. Both are
// third-party JSON, so only the fields actually read are declared.
type TwitterMedia = {
  media_key: string;
  url?: string;
  preview_image_url?: string;
};
type TweetPublicMetrics = {
  impression_count?: number;
  like_count?: number;
  bookmark_count?: number;
};
type QuoteTweet = {
  id: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: TweetPublicMetrics;
};

// Try Twitter API v2 — requires TWITTER_BEARER_TOKEN
async function fetchFromTwitterApi(tweetId: string, bearerToken: string) {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,created_at,text,note_tweet,article&expansions=author_id,article.cover_media,article.media_entities&user.fields=username&media.fields=url,preview_image_url,type`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tweet = data.data;
    if (!tweet) return null;

    const metrics = tweet.public_metrics || {};

    // article.plain_text = full article body, article.title = proper title
    const article = tweet.article || {};
    const articleTitle = article.title || "";
    const articleBody = article.plain_text || "";
    const fullText = articleBody || tweet.note_tweet?.text || tweet.text || "";

    // Find cover image from includes.media using article.cover_media key
    let coverImageUrl = "";
    const coverMediaKey = article.cover_media || "";
    if (coverMediaKey && data.includes?.media) {
      const coverMedia = data.includes.media.find((m: TwitterMedia) => m.media_key === coverMediaKey);
      if (coverMedia) {
        coverImageUrl = coverMedia.url || coverMedia.preview_image_url || "";
      }
    }

    // Extract a clean title: prefer article.title, then first meaningful line
    let extractedTitle = articleTitle;
    if (!extractedTitle) {
      const lines = fullText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^https?:\/\//.test(trimmed)) continue;
        if (trimmed.length < 10 && !/\d/.test(trimmed)) continue;
        extractedTitle = trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
        break;
      }
    }

    return {
      text: fullText,
      title: extractedTitle,
      coverImageUrl,
      isArticleTweet: !!tweet.article,
      impressions: metrics.impression_count ?? null,
      likes: metrics.like_count ?? null,
      bookmarks: metrics.bookmark_count ?? null,
      retweets: metrics.retweet_count ?? null,
      replies: metrics.reply_count ?? null,
      createdAt: tweet.created_at || null,
    };
  } catch {
    return null;
  }
}

// Fallback: Try X syndication API (public, no auth)
async function fetchFromSyndication(tweetId: string) {
  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();

    return {
      text: data.text || "",
      likes: data.favorite_count ?? null,
      createdAt: data.created_at || null,
      authorName: data.user?.name || "",
      authorHandle: data.user?.screen_name || "",
    };
  } catch {
    return null;
  }
}

// Fetch quote tweets for an article tweet
async function fetchQuoteTweets(tweetId: string, bearerToken: string, authorId?: string) {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}/quote_tweets?tweet.fields=public_metrics,created_at,text,author_id&max_results=20`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const quotes = data.data || [];

    // Find the author's own QT (most likely the promotional tweet)
    // If no authorId, return the most-liked QT
    let bestQt: QuoteTweet | null = null;
    for (const qt of quotes) {
      if (authorId && qt.author_id === authorId) {
        bestQt = qt;
        break;
      }
    }
    if (!bestQt && quotes.length > 0) {
      // Pick the most-liked quote tweet
      bestQt = quotes.reduce((best: QuoteTweet, qt: QuoteTweet) =>
        (qt.public_metrics?.like_count || 0) > (best.public_metrics?.like_count || 0) ? qt : best
      , quotes[0]);
    }

    if (!bestQt) return null;

    const qMetrics = bestQt.public_metrics || {};
    return {
      text: (bestQt.text || "").replace(/https?:\/\/t\.co\/\S+/g, "").trim(),
      tweetId: bestQt.id,
      impressions: qMetrics.impression_count ?? null,
      likes: qMetrics.like_count ?? null,
      bookmarks: qMetrics.bookmark_count ?? null,
      createdAt: bestQt.created_at || null,
    };
  } catch {
    return null;
  }
}

// POST /api/articles/scrape — accepts { url } returns title, body, metrics, etc.
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const isXUrl = url.includes("x.com") || url.includes("twitter.com");
    const tweetId = isXUrl ? extractTweetId(url) : null;
    const bearerToken = process.env.TWITTER_BEARER_TOKEN || "";

    let title = "";
    let body = "";
    let imageUrl = "";
    let impressions: number | null = null;
    let likes: number | null = null;
    let bookmarks: number | null = null;
    let postedDate: string | null = null;
    let qtTweet = "";
    let qtUrl = "";
    let qtImpressions: number | null = null;
    let qtLikes: number | null = null;

    // 1. For X/Twitter URLs, try the APIs
    if (tweetId) {
      // Try Twitter API v2 first (has full metrics + article text)
      if (bearerToken) {
        const twitterData = await fetchFromTwitterApi(tweetId, bearerToken);
        if (twitterData) {
          const rawText = twitterData.text || "";
          const cleanedText = rawText.replace(/https?:\/\/t\.co\/\S+/g, "").trim();

          // If this is an article tweet, use the article title and cover image
          if (twitterData.isArticleTweet) {
            if (twitterData.title) title = twitterData.title;
            if (twitterData.coverImageUrl) imageUrl = twitterData.coverImageUrl;
          }

          // If the tweet body is empty/just a URL, it's likely a QT tweet
          // Follow the t.co link to find the actual article
          if (cleanedText.length < 20) {
            const tcoMatch = rawText.match(/https?:\/\/t\.co\/\S+/);
            if (tcoMatch) {
              try {
                // Follow the t.co redirect to get the real URL
                const redirectRes = await fetch(tcoMatch[0], {
                  redirect: "follow",
                  signal: AbortSignal.timeout(5000),
                  headers: { "User-Agent": "Mozilla/5.0" },
                });
                const realUrl = redirectRes.url;
                const linkedTweetId = extractTweetId(realUrl);

                // If it points to another tweet, fetch that one (the actual article)
                if (linkedTweetId && linkedTweetId !== tweetId) {
                  const articleData = await fetchFromTwitterApi(linkedTweetId, bearerToken);
                  if (articleData) {
                    body = articleData.text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
                    title = articleData.title || "";
                    if (articleData.coverImageUrl) imageUrl = articleData.coverImageUrl;
                    // Use the article's metrics, not the QT's
                    impressions = articleData.impressions;
                    likes = articleData.likes;
                    bookmarks = articleData.bookmarks;
                    postedDate = articleData.createdAt
                      ? new Date(articleData.createdAt).toISOString().split("T")[0]
                      : null;
                  }
                }
              } catch {}
            }
          }

          // If we didn't resolve via redirect, use the original tweet data
          if (!body) {
            body = cleanedText;
            title = twitterData.title || "";
          }

          // Use QT tweet metrics as fallback if article metrics not found
          if (impressions == null) impressions = twitterData.impressions;
          if (likes == null) likes = twitterData.likes;
          if (bookmarks == null) bookmarks = twitterData.bookmarks;
          if (!postedDate && twitterData.createdAt) {
            postedDate = new Date(twitterData.createdAt).toISOString().split("T")[0];
          }

          // Fetch the QT tweet (the promotional tweet that quotes this article)
          // Use the article's tweet ID to find quote tweets
          const articleTweetId = body ? tweetId : null; // only if this IS the article
          const qtTweetId = articleTweetId || tweetId;
          if (bearerToken && qtTweetId) {
            // Get author_id from the original fetch
            const authorRes = await fetch(
              `https://api.twitter.com/2/tweets/${qtTweetId}?tweet.fields=author_id`,
              { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(5000) }
            ).catch(() => null);
            const authorId = authorRes ? (await authorRes.json().catch(() => ({})))?.data?.author_id : undefined;

            const qtData = await fetchQuoteTweets(qtTweetId, bearerToken, authorId);
            if (qtData) {
              qtTweet = qtData.text;
              qtUrl = `https://x.com/i/status/${qtData.tweetId}`;
              qtImpressions = qtData.impressions;
              qtLikes = qtData.likes;
            }
          }
        }
      }

      // Fallback: syndication API (public, no auth needed)
      if (!body) {
        const synData = await fetchFromSyndication(tweetId);
        if (synData) {
          body = synData.text || body;
          likes = synData.likes ?? likes;
          if (synData.createdAt) {
            postedDate = new Date(synData.createdAt).toISOString().split("T")[0];
          }
          if (body && !title) {
            // Extract title skipping URLs and empty lines
            for (const line of body.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed || /^https?:\/\//.test(trimmed)) continue;
              if (trimmed.length < 10 && !/\d/.test(trimmed)) continue;
              title = trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
              break;
            }
          }
        }
      }
    }

    // 2. For X articles, use Brave Search for body text and hero image
    if (isXUrl && (!body || body.length < 50)) {
      const braveKey = process.env.BRAVE_API_KEY || "";
      if (braveKey) {
        try {
          const braveRes = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(url)}&count=5`,
            { headers: { Accept: "application/json", "X-Subscription-Token": braveKey } }
          );
          if (braveRes.ok) {
            const braveData = await braveRes.json();
            const results = braveData.web?.results || [];
            // Find the best match
            for (const r of results) {
              if (r.url?.includes("x.com") || r.url?.includes("twitter.com")) {
                if (!title && r.title) {
                  title = r.title.replace(/^.*?\s+on\s+(X|Twitter):\s*[""\u201c]?/i, "").replace(/["""\u201d]$/, "").trim();
                }
                const extraSnippets = (r.extra_snippets || []).join("\n\n");
                const desc = [r.description || "", extraSnippets].filter(Boolean).join("\n\n").trim();
                if (desc.length > (body?.length || 0)) {
                  body = desc;
                }
                if (!imageUrl && r.thumbnail?.src) {
                  imageUrl = r.thumbnail.src;
                }
                break;
              }
            }
          }
        } catch {}
      }

      // Also try fetchUrlContent for deeper extraction
      if (!body || body.length < 100) {
        const content = await fetchUrlContent(url, { maxChars: 5000 });
        if (content && !content.includes("Could not extract")) {
          const bodyMatch = content.match(/Content:\n([\s\S]+)/);
          if (bodyMatch && bodyMatch[1].trim().length > (body?.length || 0)) {
            body = bodyMatch[1].trim();
          }
          if (!title) {
            const titleMatch = content.match(/^Title:\s*(.+)/m);
            if (titleMatch) title = titleMatch[1].trim();
          }
        }
      }
    }

    // 3. For X articles, try oembed API for thumbnail image
    if (isXUrl && !imageUrl) {
      try {
        const oembedRes = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          // Extract image from oembed HTML
          const imgMatch = (oembedData.html || "").match(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/i);
          if (imgMatch) imageUrl = imgMatch[1];
        }
      } catch {}
    }

    // 4. Try direct fetch for og:meta tags (skip for X — it returns JS-disabled page)
    if (!isXUrl) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; HermyHQ/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const html = await res.text();

          if (!title) {
            const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
            if (ogTitle) title = ogTitle[1].trim();
            if (!title) {
              const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              if (titleTag) title = titleTag[1].trim();
            }
          }

          if (!imageUrl) {
            const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
            if (ogImage) imageUrl = ogImage[1].trim();
          }
        }
      } catch {}
    }

    // 4. For non-X URLs, use Brave-powered fetchUrlContent for article body
    if (!body && !isXUrl) {
      const content = await fetchUrlContent(url, { maxChars: 5000 });
      if (content && !content.includes("Could not extract")) {
        const titleMatch = content.match(/^Title:\s*(.+)/m);
        if (titleMatch && !title) title = titleMatch[1].trim();
        const bodyMatch = content.match(/Content:\n([\s\S]+)/);
        if (bodyMatch) body = bodyMatch[1].trim();
      }
    }

    // Clean up X/Twitter titles
    if (title && isXUrl) {
      title = title
        .replace(/^.*?\s+on\s+(X|Twitter):\s*[""\u201c]?/i, "")
        .replace(/["""\u201d]$/, "")
        .trim();
    }

    // Clean body text
    if (body) {
      body = body
        .replace(/We've detected that JavaScript is disabled.*?Help Center\.?\s*/gi, "")
        .replace(/https?:\/\/t\.co\/\S+/g, "")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    return NextResponse.json({
      title: title || "",
      body: body || "",
      heroImageUrl: imageUrl || "",
      impressions,
      likes,
      bookmarks,
      postedDate,
      qtTweet: qtTweet || "",
      qtUrl: qtUrl || "",
      qtImpressions,
      qtLikes,
    });
  } catch (err) {
    console.error("POST /api/articles/scrape error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
