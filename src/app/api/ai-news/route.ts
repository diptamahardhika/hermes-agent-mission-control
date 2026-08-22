export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

// OpenRouter's public model catalog needs no API key.
const MODELS_URL = "https://openrouter.ai/api/v1/models";

// AI news feeds — plain RSS/Atom, no keys.
const NEWS_FEEDS: { url: string; source: string }[] = [
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge" },
  { url: "https://arstechnica.com/ai/feed/", source: "Ars Technica" },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat" },
];

// Hacker News front page via the free Firebase API, filtered for AI keywords.
async function fetchHN(): Promise<NewsItem[]> {
  const AI_RE = /\b(ai|a\.i\.|llm|gpt|openai|anthropic|claude|gemini|deepseek|mistral|llama|qwen|grok|copilot|machine learning|neural|diffusion|agent)\b/i;
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const ids: number[] = await res.json();
    const items = await Promise.allSettled(
      ids.slice(0, 30).map(async id => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { next: { revalidate: 1800 } });
        if (!r.ok) throw new Error();
        const it = await r.json();
        if (!it?.title || !AI_RE.test(it.title)) throw new Error();
        return {
          title: it.title as string,
          url: (it.url as string) || `https://news.ycombinator.com/item?id=${id}`,
          source: "Hacker News",
          publishedAt: ((it.time as number) || 0) * 1000,
        } satisfies NewsItem;
      })
    );
    return items.flatMap(r => (r.status === "fulfilled" ? [r.value] : []));
  } catch {
    return [];
  }
}

type ORModel = {
  id: string;
  name: string;
  created?: number;
  description?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
};

export type ModelCard = {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  free: boolean;
  createdAt: number | null;
  inputs: string[];
  tags: string[];
};

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: number | null;
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ");
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

async function fetchModels(): Promise<ModelCard[]> {
  try {
    const res = await fetch(MODELS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data.map(toCard) : [];
  } catch {
    return [];
  }
}

function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = [...xml.matchAll(/<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)];
  for (const b of blocks.slice(0, 12)) {
    const block = b[1];
    const title = tag(block, "title");
    if (!title) continue;
    let link = tag(block, "link");
    if (!link) {
      const lm = block.match(/<link[^>]*href="([^"]+)"/i);
      link = lm ? lm[1] : "";
    }
    const dateStr = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
    const ts = dateStr ? Date.parse(dateStr) : NaN;
    items.push({ title, url: link, source, publishedAt: Number.isNaN(ts) ? null : ts });
  }
  return items;
}

async function fetchNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async f => {
      const res = await fetch(f.url, { next: { revalidate: 1800 } });
      if (!res.ok) return [] as NewsItem[];
      return parseFeed(await res.text(), f.source);
    })
  );
  const all = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));
  return all
    .filter(i => i.publishedAt)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 7); // per-feed cap; global cap applied after merging HN
}

function deriveTags(m: ORModel): string[] {
  const hay = `${m.id} ${m.name} ${m.description || ""}`.toLowerCase();
  const mods = m.architecture?.input_modalities || [];
  const tags: string[] = [];
  if (/cod(e|ing)|swe-bench|terminal/.test(hay)) tags.push("coding");
  if (mods.includes("image") || /vision|vl\b|multimodal/.test(hay)) tags.push("vision");
  if (/reason|r1|thinking|o[0-9]\b/.test(hay)) tags.push("reasoning");
  if (/agent|tool[- ]call|computer[- ]use/.test(hay)) tags.push("agents");
  if (mods.includes("audio")) tags.push("audio");
  if ((m.context_length ?? 0) >= 500_000) tags.push("long-ctx");
  if (/flash|lite|mini|nano|small|turbo|\d+b\b/.test(hay)) tags.push("fast");
  return tags.slice(0, 3);
}

function toCard(m: ORModel): ModelCard {
  return {
    id: m.id,
    name: m.name,
    provider: m.id.split("/")[0] || "unknown",
    contextLength: m.context_length ?? null,
    free: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
    createdAt: m.created ? m.created * 1000 : null,
    inputs: m.architecture?.input_modalities || ["text"],
    tags: deriveTags(m),
  };
}

export async function GET() {
  const [models, news] = await Promise.all([fetchModels(), Promise.all([fetchNews(), fetchHN()]).then(([a, b]) => [...a, ...b].sort((x, y) => (y.publishedAt || 0) - (x.publishedAt || 0)).slice(0, 14))]);

  if (!models.length && !news.length) {
    return NextResponse.json({ newModels: [], freeModels: [], totalFree: 0, news: [], fetchedAt: null });
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newModels = models
    .filter(m => m.createdAt && m.createdAt > thirtyDaysAgo)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 8);

  const freeModels = models
    .filter(m => m.free)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);

  return NextResponse.json({
    newModels,
    freeModels,
    totalFree: models.filter(m => m.free).length,
    news,
    fetchedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, no-cache" } });
}
