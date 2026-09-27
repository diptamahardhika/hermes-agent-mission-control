export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

const DESIGN_SYSTEM = `You generate standalone HTML visual graphics for viral X (Twitter) articles.

== DESIGN SYSTEM (non-negotiable) ==

DIMENSIONS: 1536px wide × 864px tall. Set on <body>. overflow: hidden.

BACKGROUND: #080808 (near-black)
GRID OVERLAY: Always include this:
.grid-bg {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
}

GLOW: Use radial-gradient overlays for subtle colored glow effects behind content.

FONT: font-family: -apple-system, 'Inter', sans-serif;

COLORS:
- Text: #fff (headlines), rgba(255,255,255,0.35-0.5) (body/muted)
- Accent: pick ONE from: amber #f59e0b, blue #3b82f6 / #818cf8, green #4ade80, red #f87171, purple #a78bfa
- Cards: rgba(255,255,255,0.03) background, rgba(255,255,255,0.07) border
- Colored accents: 15% opacity backgrounds with matching text

TYPOGRAPHY:
- Headlines: 36-72px, font-weight 800, letter-spacing -0.02em
- Subtitles: 16-22px, weight 400, color rgba(255,255,255,0.3-0.4)
- Body/items: 12-15px, color rgba(255,255,255,0.45-0.6)
- Badges/labels: 11-13px, weight 600-700, uppercase, letter-spacing 0.1em

CARDS: border-radius 14-20px, subtle borders rgba(255,255,255,0.07)

BYLINE: Always include at the bottom:
<div style="position:absolute;bottom:30px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;z-index:10;">
  <span style="font-size:14px;color:rgba(255,255,255,0.25);">@yourhandle</span>
  <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.1);">HERMY HQ</span>
</div>

RULES:
- Complete, self-contained <!DOCTYPE html> documents
- ALL styles in a single <style> block — NO inline styles except the byline
- NO external resources, fonts, images, or scripts
- Use emojis for icons — they render everywhere
- Content must be LEGIBLE
- Position elements with flexbox/grid`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { articleId, title, articleBody, track, visualType, mode } = body;

    let artTitle = title;
    let artBody = articleBody;
    let artTrack = track;

    if (articleId && (!artTitle || !artBody)) {
      const article = await prisma.article.findUnique({ where: { id: articleId } });
      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
      artTitle = article.title;
      artBody = article.body;
      artTrack = article.track;
    }

    if (!artTitle || !artBody) {
      return NextResponse.json({ error: "title and articleBody required" }, { status: 400 });
    }

    // Fetch reference hero HTMLs
    let referenceContext = "";
    try {
      const refs = await prisma.article.findMany({
        where: { status: "posted", track: artTrack || undefined, heroImageHtml: { not: null } },
        select: { title: true, heroImageHtml: true, impressions: true },
        orderBy: { impressions: "desc" },
        take: 2,
      });
      if (refs.length > 0) {
        referenceContext = `\n\n== REFERENCE VISUALS FROM TOP ARTICLES ==\n${refs.map((a, i) =>
          `--- "${a.title}" (${a.impressions?.toLocaleString() || "?"} views) ---\n${(a.heroImageHtml || "").slice(0, 2000)}`
        ).join("\n\n")}`;
      }
    } catch {}

    // ── MODE: PLAN ── Analyze article and create a visual plan
    if (mode === "plan") {
      const planPrompt = `Read this entire article carefully and create a VISUAL PLAN.

TITLE: ${artTitle}
TRACK: ${artTrack}

FULL ARTICLE:
${artBody.slice(0, 6000)}

For each section of the article, recommend a visual. For each visual:
1. WHERE it should go (after which section/paragraph)
2. WHAT type: hero, data-stats, before-after, steps, grid, timeline, comparison, quote-highlight
3. WHAT content to include (specific numbers, facts, lists from the article)
4. CAN_GENERATE: true if this is something you can create as an HTML graphic (charts, infographics, data displays, comparison panels, step flows). false if it requires a real screenshot, photo, video embed, or external content the user must provide.
5. If CAN_GENERATE is false, briefly describe what the user should provide.

Return a JSON array. Each object:
{
  "position": "After section: [section name or quote]",
  "type": "hero|data|before-after|steps|grid|timeline|comparison|quote-highlight",
  "description": "Brief description of the visual",
  "content": "The specific data/text to include in the visual",
  "canGenerate": true/false,
  "userAction": null or "Screenshot X showing Y" (only if canGenerate is false)
}

Return ONLY valid JSON. No explanation, no markdown.`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://your-app.vercel.app",
          "X-Title": "Hermy HQ Article Studio",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-6",
          messages: [{ role: "user", content: planPrompt }],
          max_tokens: 4000,
          temperature: 0.5,
        }),
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
      }

      const data = await res.json() as { choices: { message: { content: string } }[] };
      const content = data.choices?.[0]?.message?.content?.trim() || "[]";

      try {
        const cleaned = content.replace(/^```json?\n?/g, "").replace(/```$/g, "").trim();
        const plan = JSON.parse(cleaned);
        return NextResponse.json({ plan });
      } catch {
        return NextResponse.json({ error: "Failed to parse plan", raw: content }, { status: 500 });
      }
    }

    // ── MODE: GENERATE SINGLE ── Generate one specific visual
    const bodyPreview = artBody.slice(0, 3000);

    const userPrompt = `Generate a ${(visualType || "hero").toUpperCase()} visual for this article.

TITLE: ${artTitle}
TRACK: ${artTrack}

ARTICLE:
${bodyPreview}

${body.content ? `SPECIFIC CONTENT TO INCLUDE IN THIS VISUAL:\n${body.content}\n` : ""}
${referenceContext}

Generate ONE complete HTML visual. Extract the most impactful data from the article. The content MUST come from the article — don't invent numbers.

Return ONLY the complete HTML document. No explanation, no markdown code blocks, no \`\`\`.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          { role: "system", content: DESIGN_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to generate visual" }, { status: 500 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const html = (data.choices?.[0]?.message?.content || "")
      .replace(/^```html?\n?/g, "")
      .replace(/```$/g, "")
      .trim();

    return NextResponse.json({
      visuals: [{ type: visualType || "hero", html }],
    });
  } catch (err) {
    console.error("POST /api/articles/generate-visuals error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
