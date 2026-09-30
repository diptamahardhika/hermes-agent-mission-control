import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

// Draft.editHistory is JSON in Prisma; every writer pushes this shape.
type DraftEditEntry = { original: string; edited: string; editedAt: string };

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { draftId, rating, reason, scheduledDate, scheduledTime, removeVisual, editText, tweakComment } = body;

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Handle tweak request — save on draft + trigger Sage
  if (tweakComment) {
    // Note: tweakRequested is not in the Prisma schema, so we store it as part of a JSON update
    // For now, just write the trigger file
    // TODO: Trigger file paths won't exist on Vercel — needs a different mechanism (e.g. queue, webhook)
    // Intentional for the local Docker deployment; see docs/local-only-paths.md
    try {
      const triggerDir = path.join("./data", "triggers");
      fs.mkdirSync(triggerDir, { recursive: true });
      fs.writeFileSync(path.join(triggerDir, `tweak-${draftId}.json`), JSON.stringify({
        type: "tweak",
        draftId,
        originalText: draft.text,
        feedback: tweakComment,
        createdAt: new Date().toISOString(),
      }, null, 2));
    } catch {}

    // Return the draft in API format
    const { feedbackRating, feedbackReason, updatedAt, ...rest } = draft;
    return NextResponse.json({
      ...rest,
      feedback: { rating: feedbackRating ?? null, reason: feedbackReason ?? "" },
      tweakRequested: {
        comment: tweakComment,
        requestedAt: new Date().toISOString(),
        status: "pending",
      },
    });
  }

  const updateData: Prisma.DraftUpdateInput = {};

  if (removeVisual) {
    updateData.visualUrl = null;
  }

  // If scheduling, update date and time
  if (scheduledDate !== undefined) {
    updateData.scheduledDate = scheduledDate;
    updateData.scheduledTime = scheduledTime ?? null;

    // Move to scheduled status
    if (draft.status === "approved" || draft.status === "scheduled") {
      updateData.status = "scheduled";
    }
  } else if (scheduledTime !== undefined) {
    // Allow updating time without changing the date
    updateData.scheduledTime = scheduledTime;
  }

  // Unschedule functionality
  if (scheduledDate === null) {
    updateData.scheduledDate = null;
    updateData.scheduledTime = null;
    // Move back to "Approved" if was "Scheduled"
    if (draft.status === "scheduled") {
      updateData.status = "approved";
    }
  }

  // Inline edit with history tracking
  if (editText !== undefined) {
    const currentHistory = (draft.editHistory as DraftEditEntry[] | null) || [];
    updateData.editHistory = [
      ...currentHistory,
      { original: draft.text, edited: editText, editedAt: new Date().toISOString() },
    ];
    updateData.text = editText;
  }

  if (rating === "undo" || rating === "pending") {
    updateData.status = "pending";
    updateData.feedbackRating = null;
    updateData.feedbackReason = "";
  } else if (rating === "approved" || rating === "up") {
    updateData.feedbackRating = "approved";
    updateData.feedbackReason = reason || "";
    updateData.status = "approved";
  } else if (rating === "rejected" || rating === "down") {
    updateData.feedbackRating = "rejected";
    updateData.feedbackReason = reason || "";
    updateData.status = "rejected";
  } else if (rating === "posted") {
    updateData.status = "posted";
    updateData.postedAt = new Date();
    if (body.postedUrl) {
      updateData.postedUrl = body.postedUrl;
      updateData.tweetUrl = body.postedUrl;
      // Extract tweet ID from URL
      const match = body.postedUrl.match(/status\/(\d+)/);
      if (match) {
        updateData.tweetId = match[1];
      }
    }
  }

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: updateData,
  });

  const { feedbackRating, feedbackReason, updatedAt, ...rest } = updated;
  return NextResponse.json({
    ...rest,
    feedback: { rating: feedbackRating ?? null, reason: feedbackReason ?? "" },
  });
}
