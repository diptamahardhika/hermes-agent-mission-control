import { NextResponse } from "next/server";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { prisma } from "@/lib/prisma";

const SCRIPTS_FILE = "./data/scripts-full.md";

function callOpenAI(apiKey: string, payload: object, timeout = 45000): string {
  const tmpFile = path.join("/tmp", `yt-ideas-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(payload));
  try {
    return execSync(
      `curl -s -X POST "https://api.openai.com/v1/chat/completions" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d @${tmpFile}`,
      { timeout, encoding: "utf-8" }
    );
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ok */ }
  }
}

function braveSearch(query: string, braveKey: string, count = 5): { title: string; url: string; description: string }[] {
  try {
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
  const apiKey = process.env.OPENAI_API_KEY || "";
  const braveKey = process.env.BRAVE_API_KEY || "";
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
  if (!braveKey) return NextResponse.json({ error: "No Brave API key" }, { status: 500 });

  // Load existing ideas to avoid duplicates
  let existing: { id: string; title: string; status: string }[] = [];
  try {
    existing = await prisma.youtubeIdea.findMany({
      select: { id: true, title: true, status: true },
    });
  } catch { /* ok */ }
  const existingTitles = existing.map(i => i.title).join(", ");

  // Load rejection feedback to learn taste
  let feedback: { title: string; reason: string | null }[] = [];
  try {
    feedback = await prisma.youtubeFeedback.findMany({
      where: { type: "idea" },
      select: { title: true, reason: true },
    });
  } catch { /* ok */ }
  const rejectionContext = feedback.length > 0
    ? `\n\nIDEAS THE USER REJECTED (learn from this):\n${feedback.map(f => `- "${f.title}" — reason: ${f.reason}`).join("\n")}`
    : "";

  // Load existing scripts for covered topics (keep .md file read, wrap in try/catch for Vercel)
  let coveredTopics = "";
  try { coveredTopics = fs.readFileSync(SCRIPTS_FILE, "utf-8").match(/### .+/g)?.join(", ") || ""; } catch { /* ok - file may not exist on Vercel */ }

  // -- STEP 1: Ask GPT to generate search queries --
  const queryGenResult = callOpenAI(apiKey, {
    model: "gpt-4o-mini",
    messages: [
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
      { role: "user", content: "10 diverse search queries for fascinating real stories. Mix mainstream brands, crypto, pop culture." }
    ],
    temperature: 0.95,
    response_format: { type: "json_object" }
  });

  const queryData = JSON.parse(queryGenResult);
  const queries: string[] = JSON.parse(queryData.choices[0].message.content).queries || [];

  // -- STEP 2: Run each query through Brave Search --
  const allSearchResults: { query: string; results: { title: string; url: string; description: string }[] }[] = [];
  for (const query of queries.slice(0, 10)) {
    const results = braveSearch(query, braveKey, 5);
    allSearchResults.push({ query, results });
  }

  // Compile search results into a readable format
  const searchContext = allSearchResults.map(sr =>
    `Query: "${sr.query}"\n${sr.results.map(r => `- ${r.title} (${r.url})\n  ${r.description}`).join("\n")}`
  ).join("\n\n");

  // -- STEP 3: Feed real articles to GPT to create ideas --
  const ideaGenResult = callOpenAI(apiKey, {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You create viral short-form video ideas for the user based on REAL articles and stories found via web search.

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

Output JSON: {"ideas":[{"title":"short title","hook":"2-3 line spoken word scroll-stopper","angle":"founder/crypto lesson","hookType":"observation|experience|expert|controversial","funnelStage":"TOF|MOF|BOF","sourceUrl":"url from search results","sourceSummary":"1-2 sentence summary of the real story"}]}` },
      { role: "user", content: `Based on these REAL articles found via web search, create 10 video ideas. Each idea MUST reference a real story and include the source URL.\n\nSEARCH RESULTS:\n${searchContext}\n\nMake the hooks FIRE.` }
    ],
    temperature: 0.85,
    response_format: { type: "json_object" }
  }, 60000);

  try {
    const data = JSON.parse(ideaGenResult);
    const content = JSON.parse(data.choices[0].message.content);
    const newIdeas = content.ideas || content;

    // Append to existing (only truly new ones)
    const existingSet = new Set(existing.map(i => i.title));
    const fresh = newIdeas.filter((i: { title: string }) => !existingSet.has(i.title));

    // Insert fresh ideas into the database
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

    return NextResponse.json({ added: fresh.length });
  } catch (e) {
    return NextResponse.json({ error: "Failed", details: String(e) }, { status: 500 });
  }
}
