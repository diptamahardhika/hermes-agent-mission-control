export const maxDuration = 120;
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

async function callLLM(apiKey: string, apiBase: string, payload: object): Promise<string> {
  const res = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json().then(d => JSON.stringify(d));
}

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
}

interface Draft {
  title?: string;
  status?: string;
  // non-optional: the filter/render paths below always guard on it first
  feedback: { rating?: string; reason?: string };
}

interface Transcript {
  title?: string;
  views?: number;
}

interface LongformScript {
  title?: string;
  status?: string;
  rejectedReason?: string;
}

async function braveSearch(query: string, braveKey: string, count = 5): Promise<{ title: string; url: string; description: string }[]> {
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": braveKey } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as BraveResponse;
    return (data.web?.results || []).map((r) => ({ title: r.title, url: r.url, description: r.description }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { topic, hook: existingHook, type: contentType } = await req.json();
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });

  // Use XAI (Grok) — already configured on Vercel. Falls back to OpenAI if set.
  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || "";
  const apiBase = process.env.XAI_API_KEY ? "https://api.x.ai/v1" : "https://api.openai.com/v1";
  const model = process.env.XAI_API_KEY ? "grok-4-1-fast-non-reasoning" : "gpt-4o-mini";
  const braveKey = process.env.BRAVE_API_KEY || "";
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  // Step 1: Web search to gather real context
  let sourceContext = "";
  const sourceUrls: string[] = [];

  if (braveKey) {
    // Generate search queries
    const queryResult = await callLLM(apiKey, apiBase, {
      model,
      messages: [
        { role: "system", content: "Extract 3 specific search queries to research this video topic thoroughly. Return JSON: {\"queries\":[\"query1\",\"query2\",\"query3\"]}" },
        { role: "user", content: `Long-form video topic: ${topic}` }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    let queries: string[] = [];
    try {
      const qd = JSON.parse(queryResult);
      queries = JSON.parse(qd.choices[0].message.content).queries || [];
    } catch { /* ok */ }

    for (const query of queries.slice(0, 3)) {
      const results = await braveSearch(query, braveKey, 3);
      if (results.length > 0) {
        sourceContext += `\n\n## SEARCH: "${query}"\n${results.map(r => {
          sourceUrls.push(r.url);
          return `- ${r.title} (${r.url})\n  ${r.description}`;
        }).join("\n")}`;
      }
    }
  }

  // Step 2: Load voice analysis
  let voiceGuide = "";
  try {
    voiceGuide = fs.readFileSync("./data/longform-voice-analysis.md", "utf-8");
  } catch { /* ok */ }

  // Step 2b: Load feedback history (what the user likes/hates)
  let feedbackContext = "";
  try {
    const drafts = JSON.parse(fs.readFileSync("./data/drafts.json", "utf-8")) as Draft[];
    const rejected = drafts.filter((d) => d.feedback?.rating === "down" && d.feedback?.reason);
    const approved = drafts.filter((d) => d.status === "approved" || d.feedback?.rating === "up");
    
    if (rejected.length > 0) {
      feedbackContext += "\n## THINGS THE USER HATES (from rejected drafts):\n";
      for (const r of rejected.slice(0, 15)) {
        feedbackContext += `- "${r.title}" REJECTED because: "${r.feedback.reason}"\n`;
      }
    }
    if (approved.length > 0) {
      feedbackContext += "\n## THINGS THE USER LIKES (approved drafts):\n";
      for (const a of approved.slice(0, 10)) {
        feedbackContext += `- "${a.title}" ✅\n`;
      }
    }
  } catch { /* ok */ }

  // Step 2c: Load YouTube performance data
  let performanceContext = "";
  try {
    const transcripts = JSON.parse(fs.readFileSync("./data/youtube-transcripts.json", "utf-8")) as Transcript[];
    const sorted = transcripts.sort((a, b) => (b.views || 0) - (a.views || 0));
    performanceContext = "\n## TOP PERFORMING YOUTUBE VIDEOS:\n";
    for (const v of sorted.slice(0, 5)) {
      performanceContext += `- "${v.title}" — ${v.views} views\n`;
    }
    performanceContext += "\nThe AI trading/experiment format massively outperforms other content.\n";
  } catch { /* ok */ }

  // Step 2d: Load rejected longform scripts for learning
  let longformFeedback = "";
  try {
    const lfScripts = JSON.parse(fs.readFileSync("./data/longform-scripts.json", "utf-8")) as LongformScript[];
    const rejectedLf = lfScripts.filter((s) => s.status === "rejected" && s.rejectedReason);
    if (rejectedLf.length > 0) {
      longformFeedback = "\n## REJECTED LONGFORM SCRIPTS:\n";
      for (const r of rejectedLf) {
        longformFeedback += `- "${r.title}" REJECTED: "${r.rejectedReason}"\n`;
      }
    }
  } catch { /* ok */ }

  // Step 3: Generate long-form script
  const systemPrompt = `You are writing a long-form YouTube video script for the user, a founder and content creator.

## THE USER'S LONG-FORM VOICE (30-Transcript Analysis)

**Narrative Strategy and Performance Optimization:**

1. **Content Architecture (Statistically Most Engaging):**
   - Personal experiment/challenge format
   - Clear, quantifiable goal
   - Day-by-day progression
   - Unexpected insights
   - Data-driven conclusions
   - Vulnerability in sharing results

2. **Voice Characteristics:**
   - "Curious explorer" — NOT a lecturer
   - Learning WITH the audience, not AT them
   - Comfortable admitting initial ignorance
   - Technical depth without academic language

3. **Opening Hook Hierarchy (By Performance):**
   - "I was doing X when I noticed Y"
   - "Everyone says Z. So I decided to test it."
   - "I kept seeing something and realized I didn't understand it."

4. **Linguistic Performance Markers:**
   - Primary transition: "So,"
   - Secondary transitions:
     * "And here's the thing"
     * "Which made me realize something"
     * "See,"
   - Conversational fillers: "like," "I mean," "honestly"

5. **Humor Guidelines:**
   - Dry, self-deprecating
   - Observational comedy
   - Highlight absurdity without forcing jokes
   - Meta-commentary on process

6. **Content Structure:**
   1. Personal discovery moment
   2. Clear investigation goal
   3. Systematic exploration
   4. Unexpected insights
   5. Broader implications
   6. Soft, organic conclusion

7. **Language Restrictions:**
   - No em dashes
   - Avoid academic vocabulary
   - No exaggerated YouTuber language
   - Minimal CTAs
   - Prioritize genuine curiosity

8. **High-Performance Topic Types:**
   - Technology disruption
   - Personal experiments
   - Demystifying complex topics
   - Unexpected perspectives on trends

9. **Sentence Mechanics:**
   - Mix technical explanation + conversational reaction
   - Short, punchy sentences
   - Rarely academic
   - Strategic emphatic words: "literally," "impressive"

10. **Fundamental Principle:**
    Sound like a smart, curious friend figuring something out — NOT an expert lecturing.

## Performance Correlation Insights
- Experiment/challenge videos generate 3-5x more engagement
- Personal vulnerability increases viewer retention
- Unexpected topic approaches drive curiosity
- Technical topics made accessible through storytelling

**Absolute Rule:** Authenticity trumps polish. Always.

${voiceGuide ? `## FULL VOICE ANALYSIS REFERENCE\n${voiceGuide.slice(0, 3000)}` : ""}
${feedbackContext}
${performanceContext}
${longformFeedback}

${existingHook ? `## EXISTING HOOK (keep or improve):\n"${existingHook}"\n` : ""}

## SOURCE MATERIAL (verified):
${sourceContext || "No sources — be cautious with claims, hedge everything."}

## SCRIPT FORMAT
Write a FULL script in markdown with:
- Clear section headers (## HOOK, ## PART 1: ..., etc.)
- Stage directions in *[brackets]* for B-roll/screen recordings
- ALL dialogue written as SPOKEN WORD, exactly how the user would say it on camera
- Target: 8-15 minutes when read aloud (~1500-2500 words)
- Use their actual patterns: "So, I decided to look into it just to understand it." / "And here's where it gets interesting."

## OUTPUT FORMAT — valid JSON:
{
  "title": "Compelling YouTube title",
  "hook": "The first 2-3 sentences that stop the scroll — personal, narrative, curiosity-driven",
  "outline": "Section1 → Section2 → Section3 → ...",
  "targetLength": "X-Y min",
  "fullScript": "Full markdown script with all sections, stage directions, and dialogue",
  "factCheck": {
    "status": "✅",
    "verified": ["list of verified claims"],
    "issues": ["any issues found"]
  }
}`;

  const genResult = await callLLM(apiKey, apiBase, {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a full long-form video script about: ${topic}\n\nMake it feel real and honest. Use facts from the source material. Write the COMPLETE script, not just an outline.` }
    ],
    temperature: 0.85,
    response_format: { type: "json_object" }
  });

  const genData = JSON.parse(genResult);
  const script = JSON.parse(genData.choices[0].message.content);

  return NextResponse.json({
    id: `lf-${Date.now()}`,
    title: script.title,
    hook: script.hook,
    outline: script.outline,
    targetLength: script.targetLength || "8-12 min",
    fullScript: script.fullScript,
    platforms: ["youtube", "twitter"],
    factCheck: script.factCheck || { status: "✅", verified: [], issues: [] },
    status: "draft",
    type: contentType || "article",
    createdAt: new Date().toISOString().split("T")[0],
    notes: "",
  });
}
