export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";

// TODO: This path won't exist on Vercel — consider bundling voice-rules or storing in DB
// Intentional for the local Docker deployment; see docs/local-only-paths.md
const VOICE_RULES = path.join("./data/tweet-library", "voice-rules.md");

// Draft.editHistory is JSON in Prisma; every writer pushes this shape.
type DraftEditEntry = { original: string; edited: string; editedAt: string };

export async function POST(req: NextRequest) {
  const { draftId, comment } = await req.json();
  if (!draftId || !comment) {
    return NextResponse.json({ error: "draftId and comment required" }, { status: 400 });
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Handle visual tweaks separately
  if (comment.startsWith("[VISUAL]")) {
    // Trigger visual regeneration
    try {
      const baseUrl = req.nextUrl.origin;
      execSync(
        `curl -s -X POST "${baseUrl}/api/x-content/generate-visual" -H "Content-Type: application/json" -d '{"draftId":"${draftId}"}'`,
        { timeout: 30000 }
      );
      // Re-read after visual gen
      const updatedDraft = await prisma.draft.findUnique({ where: { id: draftId } });
      if (updatedDraft) {
        const { feedbackRating, feedbackReason, updatedAt, ...rest } = updatedDraft;
        return NextResponse.json({
          ok: true,
          draft: {
            ...rest,
            feedback: { rating: feedbackRating ?? null, reason: feedbackReason ?? "" },
          },
        });
      }
    } catch {
      return NextResponse.json({ error: "Visual generation failed" }, { status: 500 });
    }
  }

  // Text tweak: use AI to rewrite
  try {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 500 });
    }

    let voiceRules = "";
    try {
      voiceRules = fs.readFileSync(VOICE_RULES, "utf-8");
    } catch {
      // Gracefully degrade if voice-rules.md is not available (e.g. on Vercel)
    }

    const systemPrompt = `You rewrite tweets based on user feedback. Output ONLY the rewritten tweet text, nothing else.

Voice rules to follow:
${voiceRules}

Key rules:
- Never use em dashes (\u2014)
- Write lowercase, casual, like texting a friend
- Use real numbers and data when present
- Keep the core idea but apply the requested changes
- Don't add generic filler or AI-sounding phrases`;

    const userPrompt = `Original tweet:
${draft.text}

Feedback/tweak request:
${comment}

Rewrite the tweet applying this feedback. Output ONLY the new tweet text.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    const data = await res.json();
    const newText = data.choices?.[0]?.message?.content?.trim();

    if (newText) {
      // Re-read to avoid race conditions
      const freshDraft = await prisma.draft.findUnique({ where: { id: draftId } });
      if (freshDraft) {
        const currentHistory = (freshDraft.editHistory as DraftEditEntry[] | null) || [];
        const updated = await prisma.draft.update({
          where: { id: draftId },
          data: {
            text: newText,
            editHistory: [
              ...currentHistory,
              {
                original: freshDraft.text,
                edited: newText,
                editedAt: new Date().toISOString(),
              },
            ],
          },
        });

        const { feedbackRating, feedbackReason, updatedAt, ...rest } = updated;
        return NextResponse.json({
          ok: true,
          draft: {
            ...rest,
            feedback: { rating: feedbackRating ?? null, reason: feedbackReason ?? "" },
            previousText: freshDraft.text,
            tweakRequested: { comment, status: "done" },
            tweakHistory: [
              {
                originalText: freshDraft.text,
                comment: comment,
                resultText: newText,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });
      }
    }

    return NextResponse.json({ error: "No result from AI" }, { status: 500 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
