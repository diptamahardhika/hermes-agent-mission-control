import { NextResponse } from "next/server";
import fs from "fs";
import { prisma } from "@/lib/prisma";

const NOUS_BASE_FALLBACK = "https://inference-api.nousresearch.com/v1";
const MODEL = "reflection/beam-1.0-501b-a23b:free";

const AUTH_PATHS = [
  "/Users/pradiptamahardika/.hermes/auth.json",
  `${process.env.HOME || ""}/.hermes/auth.json`,
];

interface NousAuth { token: string; baseUrl: string; }

function readNousState(): { state: any; path: string } | null {
  for (const p of AUTH_PATHS) {
    if (!p) continue;
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const d = JSON.parse(raw);
      const n = d?.providers?.nous;
      if (n?.access_token) return { state: d, path: p };
    } catch {
      // try next path
    }
  }
  return null;
}

function isExpiring(expiresAt: any, skewSec = 120): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (isNaN(t)) return true;
  return t - Date.now() < skewSec * 1000;
}

async function refreshNousToken(state: any, filePath: string): Promise<NousAuth | null> {
  const n = state?.providers?.nous;
  if (!n?.refresh_token || !n?.client_id) return null;
  const portalBase = n.portal_base_url || "https://portal.nousresearch.com";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: n.refresh_token,
    client_id: n.client_id,
  }).toString();
  try {
    const res = await fetch(`${portalBase}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      inference_base_url?: string;
    };
    if (!data.access_token) return null;
    const now = Date.now();
    const expiresIn = data.expires_in || 3600;
    n.access_token = data.access_token;
    n.refresh_token = data.refresh_token || n.refresh_token;
    n.expires_in = expiresIn;
    n.obtained_at = new Date(now).toISOString();
    n.expires_at = new Date(now + expiresIn * 1000).toISOString();
    if (data.inference_base_url) n.inference_base_url = data.inference_base_url;
    // persist rotated token back to disk (refresh tokens are single-use)
    try {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch {
      // non-fatal; token still usable in-memory this request
    }
    return { token: n.access_token, baseUrl: n.inference_base_url || NOUS_BASE_FALLBACK };
  } catch {
    return null;
  }
}

async function getNousAuth(): Promise<NousAuth | null> {
  const found = readNousState();
  if (!found) return null;
  const { state, path: filePath } = found;
  const n = state.providers.nous;
  if (!isExpiring(n.expires_at)) {
    return { token: n.access_token, baseUrl: n.inference_base_url || NOUS_BASE_FALLBACK };
  }
  // expired or expiring — refresh
  const refreshed = await refreshNousToken(state, filePath);
  if (refreshed) return refreshed;
  // refresh failed; fall back to existing token (may still work briefly)
  return { token: n.access_token, baseUrl: n.inference_base_url || NOUS_BASE_FALLBACK };
}

async function callLLM(messages: { role: string; content: string }[], timeoutMs = 60000): Promise<string> {
  const auth = await getNousAuth();
  if (!auth) {
    throw new Error("Hermes auth not found. Run `hermes` once to log in, then retry.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${auth.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.85,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hermes LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

function braveSearch(query: string, braveKey: string, count = 5): { title: string; url: string; description: string }[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require("child_process");
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = execSync(
      `curl -s "${searchUrl}" -H "Accept: application/json" -H "X-Subscription-Token: ${braveKey}"`,
      { timeout: 10000, encoding: "utf-8" }
    );
    const data = JSON.parse(res) as { web?: { results?: { title: string; url: string; description: string }[] } };
    return (data.web?.results || []).map((r) => ({ title: r.title, url: r.url, description: r.description }));
  } catch {
    return [];
  }
}

export async function POST() {
  const braveKey = process.env.BRAVE_API_KEY || "";
  const hasBrave = !!braveKey;

  let existing: { id: string; title: string; status: string }[] = [];
  try {
    existing = await prisma.youtubeIdea.findMany({
      select: { id: true, title: true, status: true },
    });
  } catch {
    // ok
  }
  const existingTitles = existing.map((i) => i.title).join(", ");

  let feedback: { title: string; reason: string | null }[] = [];
  try {
    feedback = await prisma.youtubeFeedback.findMany({
      where: { type: "idea" },
      select: { title: true, reason: true },
    });
  } catch {
    // ok
  }
  const rejectionContext = feedback.length > 0
    ? `\n\nIDEAS THE USER REJECTED (learn from this):\n${feedback.map((f) => `- "${f.title}" — reason: ${f.reason}`).join("\n")}`
    : "";

  let coveredTopics = "";
  try {
    coveredTopics = fs.readFileSync("./data/scripts-full.md", "utf-8").match(/### .+/g)?.join(", ") || "";
  } catch {
    // file may not exist
  }

  let searchContext = "";
  if (hasBrave) {
    let queryGenResult = "";
    try {
      queryGenResult = await callLLM([
        { role: "system", content: `You generate search queries to find fascinating REAL stories about brands, businesses, and cultural moments for a viral short-form video creator.

The creator covers a WIDE mix: mainstream brands (Red Bull, Nike, Barbie, Tesla, Apple, McDonald's, etc.), tech, pop culture, and business strategy. Most videos are about mainstream brands with a marketing/founder lesson.

Generate 10 diverse search queries that will find REAL, fascinating, lesser-known stories. Mix:
- 6-7 mainstream brand/business/pop culture stories
- 2-3 crypto/web3 stories
- Go for "WAIT REALLY?" stories — surprising pivots, near-failures, hidden strategies, controversial decisions

DO NOT search for stories already covered: ${coveredTopics}
DO NOT search for ideas already generated: ${existingTitles}
${rejectionContext}

Output JSON: {"queries":["search query 1","search query 2",...]}` },
        { role: "user", content: "10 diverse search queries for fascinating real stories. Mix mainstream brands, crypto, pop culture." },
      ], 45000);
    } catch (e) {
      return NextResponse.json({ error: "LLM call failed", details: String(e) }, { status: 500 });
    }

    let queries: string[] = [];
    try {
      const parsed = JSON.parse(queryGenResult);
      queries = parsed.queries || (parsed.choices && JSON.parse(parsed.choices[0].message.content).queries) || [];
    } catch {
      queries = [];
    }

    const allSearchResults: { query: string; results: { title: string; url: string; description: string }[] }[] = [];
    for (const query of queries.slice(0, 10)) {
      const results = braveSearch(query, braveKey, 5);
      allSearchResults.push({ query, results });
    }
    searchContext = allSearchResults.map((sr) =>
      `Query: "${sr.query}"\n${sr.results.map((r) => `- ${r.title} (${r.url})\n  ${r.description}`).join("\n")}`
    ).join("\n\n");
  }

  const hasSearch = !!searchContext.trim();
  const ideaPrompt = hasSearch
    ? `Based on these REAL articles found via web search, create 10 video ideas. Each idea MUST reference a real story and include the source URL.\n\nSEARCH RESULTS:\n${searchContext}\n\nMake the hooks FIRE.`
    : `Create 10 viral short-form video ideas for a creator who covers mainstream brands, tech, pop culture, business strategy, and crypto. Each idea should be a REAL, fascinating, lesser-known story about a brand/business/person. Make the hooks FIRE. Name specific brands/people.`;

  const systemRules = hasSearch
    ? `You create viral short-form video ideas for the user based on REAL articles and stories found via web search.

CRITICAL RULES:
- Each idea MUST be based on a REAL story from the search results below
- Each idea MUST include a sourceUrl from the search results
- Each idea MUST include a sourceSummary (1-2 sentence summary of the real story)
- DO NOT invent or embellish stories beyond what the sources say
- Hook must stop the scroll in 3 seconds
- Use proven hook formats: "I did X unexpected Y happened", observation hooks, desired outcome hooks, counter-assumption hooks
- Mix funnel stages: 5 TOF (wide appeal), 3 MOF (expertise), 2 BOF (authority)
- MAX 2-3 crypto-related ideas out of 10. Rest should be mainstream brands/culture.
- DO NOT repeat these existing ideas: ${existingTitles}
- DO NOT use stories already covered: ${coveredTopics}
- Each hook should have normal punctuation (commas, periods)
- Always name the SPECIFIC brand/person — never be vague
${rejectionContext}

Output JSON: {"ideas":[{"title":"short title","hook":"2-3 line spoken word scroll-stopper","angle":"founder/crypto lesson","hookType":"observation|experience|expert|controversial","funnelStage":"TOF|MOF|BOF","sourceUrl":"url from search results","sourceSummary":"1-2 sentence summary of the real story"}]}`
    : `You create viral short-form video ideas for a creator who covers mainstream brands, tech, pop culture, business strategy, and crypto.

CRITICAL RULES:
- Each idea must be a REAL, fascinating, lesser-known story about a specific brand/person/business
- Hook must stop the scroll in 3 seconds
- Use proven hook formats: "I did X unexpected Y happened", observation hooks, desired outcome hooks, counter-assumption hooks
- Mix funnel stages: 5 TOF (wide appeal), 3 MOF (expertise), 2 BOF (authority)
- MAX 2-3 crypto-related ideas out of 10. Rest should be mainstream brands/culture.
- DO NOT repeat these existing ideas: ${existingTitles}
- DO NOT use stories already covered: ${coveredTopics}
- Each hook should have normal punctuation (commas, periods)
- Always name the SPECIFIC brand/person — never be vague
${rejectionContext}

Output JSON: {"ideas":[{"title":"short title","hook":"2-3 line spoken word scroll-stopper","angle":"founder/crypto lesson","hookType":"observation|experience|expert|controversial","funnelStage":"TOF|MOF|BOF","sourceUrl":"","sourceSummary":"1-2 sentence summary of the real story"}]}`;

  let ideaGenResult = "";
  try {
    ideaGenResult = await callLLM([
      { role: "system", content: systemRules },
      { role: "user", content: ideaPrompt },
    ], 60000);
  } catch (e) {
    return NextResponse.json({ error: "LLM call failed", details: String(e) }, { status: 500 });
  }

  try {
    const parsed = JSON.parse(ideaGenResult);
    const content = parsed.choices ? JSON.parse(parsed.choices[0].message.content) : parsed;
    const newIdeas = content.ideas || content;

    const existingSet = new Set(existing.map((i) => i.title));
    const fresh = (Array.isArray(newIdeas) ? newIdeas : []).filter((i: { title: string }) => !existingSet.has(i.title));

    for (const idea of fresh) {
      await prisma.youtubeIdea.create({
        data: {
          title: idea.title,
          hook: idea.hook || null,
          angle: idea.angle || null,
          hookType: idea.hookType || null,
          funnelStage: idea.funnelStage || null,
          status: "pending",
        },
      });
    }

    return NextResponse.json({ added: fresh.length, source: hasSearch ? "brave+hermes" : "hermes-only" });
  } catch (e) {
    return NextResponse.json({ error: "Failed", details: String(e) }, { status: 500 });
  }
}
