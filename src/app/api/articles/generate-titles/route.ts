export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { fetchUrlContent } from "@/lib/fetch-url-content";
import { errorMessage } from "@/lib/errors";

const TRACK_DESCRIPTIONS: Record<string, string> = {
  "mega-viral": `MEGA-VIRAL TRACK: Shocking data stories about how companies harvest user data, manipulate users, or profit from something people don't realize.
The formula: You thought X was [innocent thing]. Actually, [shocking betrayal].
These articles expose mass-scale violations with specific numbers and receipts. The reader is the protagonist — they've been affected without knowing.

ALREADY COVERED (DO NOT suggest titles about these): reCAPTCHA, CAPTCHA, Google Street View labeling, Alexa/Echo listening, Amazon surveillance, BetterHelp selling therapy data, 23andMe DNA, Google Photos facial recognition.

Generate titles about FRESH UNEXPLORED topics in this spirit. Think: other apps, platforms, services that secretly monetize user behavior. Examples of unexplored territory: Spotify mood data, LinkedIn skills data, Duolingo translation labor, fitness trackers, period tracking apps, banking apps, browser extensions, mobile games, smart TVs, free VPN services, loyalty programs, credit card data, insurance companies and health apps, grocery store loyalty cards, hotel key data, car telematics, smart home devices beyond Alexa.`,

  "local-viral": `LOCAL-VIRAL TRACK: Claude/AI tools/builder niche content — practical AI workflows.
Think: "How I use Claude Code" deep dives, AI agent setup guides, productivity workflows.
The formula: Here's exactly how I [specific result] using [specific tool].
Titles should promise actionable, copy-paste value for builders and developers.`,

  "icp-viral": `ICP-VIRAL TRACK: Agency/founder content that books calls (Trojan horse format).
Think: Client acquisition systems, pricing strategies, positioning frameworks.
The formula: Goes viral as useful content, CTA for calls/services at the end.
Titles should promise systems/frameworks that solve expensive business problems.`,
};

// POST /api/articles/generate-titles — accepts { track, themes, inspirationUrls, libraryInspirations }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { track, themes, inspirationUrls, libraryInspirations } = body;

    const selectedThemes: string[] = themes ? JSON.parse(themes) : [];
    const urls: string[] = inspirationUrls ? JSON.parse(inspirationUrls) : [];
    const libArticles: { title: string; body: string; impressions: number | null; likes: number | null; bookmarks: number | null }[] = libraryInspirations || [];

    // Fetch external URL content in parallel
    const urlContents = await Promise.all(
      urls.map((url) => fetchUrlContent(url, { maxChars: 2000 }))
    );
    const externalContext = urlContents
      .filter((c) => c && !c.includes("Could not extract"))
      .map((content, i) => `External inspiration ${i + 1}:\n${content}`)
      .join("\n\n");

    // Build library article context with full bodies
    const libraryContext = libArticles
      .map((a, i) => {
        const metrics = [
          a.impressions != null ? `${a.impressions.toLocaleString()} impressions` : null,
          a.likes != null ? `${a.likes.toLocaleString()} likes` : null,
          a.bookmarks != null ? `${a.bookmarks.toLocaleString()} bookmarks` : null,
        ].filter(Boolean).join(", ");
        const bodyPreview = a.body.slice(0, 1500);
        return `--- YOUR ARTICLE ${i + 1}: "${a.title}" (${metrics || "no metrics"}) ---\n${bodyPreview}`;
      })
      .join("\n\n");

    const trackDesc = TRACK_DESCRIPTIONS[track] || TRACK_DESCRIPTIONS["local-viral"];

    const systemPrompt = `You are a viral content strategist who writes titles for your articles.
Your titles consistently get millions of views because they:
1. Promise a specific, surprising revelation
2. Create personal stakes for the reader ("you" language when appropriate)
3. Use concrete numbers when available
4. Avoid clickbait clichés — be specific, not vague

${trackDesc}

${selectedThemes.length > 0 ? `Themes to incorporate: ${selectedThemes.join(", ")}` : ""}

${libraryContext ? `\n== YOUR PROVEN VIRAL ARTICLES (STUDY THESE CAREFULLY) ==
Analyze WHY each of these articles went viral. Look at:
- How the title creates urgency or curiosity
- The opening hook that stops the scroll
- The structure and pacing that keeps readers engaged
- The specific numbers and claims that make it feel real and important
- The emotional stakes — how it makes the reader feel personally implicated

DO NOT copy these titles. Instead, extract the PATTERNS that made them work and apply those patterns to completely new topics and angles.

${libraryContext}` : ""}

${externalContext ? `\n== EXTERNAL INSPIRATION (additional style reference) ==\n${externalContext}` : ""}

TITLE STYLE RULES (non-negotiable):
- NEVER use em dashes (—) or hyphens connecting clauses. Ever.
- Do NOT use headline/title case. Use sentence case only.
- Do NOT add subtitles or "Here's what..." appended explanations
- Short and punchy. Under 70 characters.
- Often start with a number or shocking stat
- "you" language makes the reader feel personally implicated
- Statement energy, not question energy

EXAMPLES OF CORRECT STYLE (from your actual viral articles):
- "500,000 hours of free human labor. Every single day."
- "200 million homes. Always on. Always recording."
- "$7.8 million. That's the fine. 2 million people. That's how many got sold."
- "There is a small plastic tube sitting in a lab somewhere."
- "You stored the memories. They stored the faces."

EXAMPLES OF WRONG STYLE (do not generate like this):
- "Spotify Sells Your Mood Data to Brands. Here's What They Know" (headline case + subtitle)
- "Free VPNs Don't Hide Your Data — They Sell It" (em dash, headline case)
- "How Grocery Stores Know You're Pregnant Before You Do" (How... format, too generic)

Generate exactly 8 title options in the correct style. Each must be distinct in angle and topic.

Return ONLY a JSON array of 8 strings. No explanation, no markdown, just the array.
Example: ["Title 1", "Title 2", ...]`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app.vercel.app",
        "X-Title": "Hermy HQ Article Studio",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate 8 viral title options now." },
        ],
        max_tokens: 1000,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Failed to generate titles" }, { status: 500 });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() || "[]";

    // Parse the JSON array from the response
    let titles: string[];
    try {
      // Handle potential markdown code blocks
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      titles = JSON.parse(cleaned);
      if (!Array.isArray(titles)) throw new Error("Not an array");
    } catch {
      console.error("Failed to parse titles:", content);
      // Fallback: try to extract titles from text
      titles = content.split("\n").filter(line => line.trim()).slice(0, 8);
    }

    return NextResponse.json({
      titles,
      track,
      themes: selectedThemes,
      inspirationUrls: urls,
    });
  } catch (err) {
    console.error("POST /api/articles/generate-titles error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
