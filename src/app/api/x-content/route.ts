export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import type { Draft, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

/**
 * The API draft shape: the Prisma row with feedback flattened into a nested
 * object and `updatedAt` dropped (the client never reads it).
 */
type ApiDraft = Omit<
  Draft,
  "feedbackRating" | "feedbackReason" | "updatedAt" | "metrics"
> & {
  feedback: { rating: string | null; reason: string };
  /**
   * Widened from Prisma's `JsonValue | null`: `mergeMetrics` can return
   * `undefined` when both sources are empty, and the row is only ever
   * serialized to JSON (where an `undefined` key is omitted, as before).
   */
  metrics: Prisma.JsonValue | null | undefined;
};

/**
 * A row for a tweet posted directly on X, which has no Draft row. Returned
 * alongside real drafts by GET. Dates are ISO strings here, exactly as the
 * synthetic row has always been serialized.
 */
type SyntheticDraft = {
  id: string;
  text: string;
  model: string;
  status: string;
  type: string;
  feedback: { rating: string; reason: string };
  createdAt: string;
  postedAt: string;
  tweetUrl: string | null;
  postedUrl: string | null;
  tweetId: string | null;
  metrics: Prisma.JsonValue;
  editHistory: unknown[];
};

/** Read a property from an untyped JSON value without asserting `any`. */
function prop(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as Record<string, unknown>)[key];
}

/** Coerce a Prisma JSON column to a plain object, defaulting to `{}`. */
function asMetricsBlob(value: Prisma.JsonValue | null): Prisma.InputJsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Prisma.InputJsonObject;
  }
  return {};
}

/** Convert a Prisma Draft row to the API shape the frontend expects. */
function draftToApi(draft: Draft): ApiDraft {
  const { feedbackRating, feedbackReason, updatedAt, ...rest } = draft;
  return {
    ...rest,
    feedback: { rating: feedbackRating ?? null, reason: feedbackReason ?? "" },
  };
}

/** Extract the best (highest) view count from a metrics object (flat or checkpoint format). */
function bestViews(m: Prisma.JsonValue | null | undefined): number {
  if (!m || typeof m !== "object") return 0;
  const flat = prop(m, "views");
  if (typeof flat === "number") return flat;
  let best = 0;
  for (const val of Object.values(m)) {
    if (val && typeof val === "object") {
      const v = Number(prop(val, "views")) || 0;
      if (v > best) best = v;
    }
  }
  return best;
}

/** Merge metrics: combine both sources, preferring whichever has higher views. */
function mergeMetrics(
  draftMetrics: Prisma.JsonValue | null | undefined,
  tweetMetricCheckpoints: Prisma.JsonValue | null | undefined,
): Prisma.JsonValue | undefined {
  const draftViews = bestViews(draftMetrics);
  const tmViews = bestViews(tweetMetricCheckpoints);
  // If both have data, merge checkpoints (draft.metrics wins on conflict)
  if (draftMetrics && tweetMetricCheckpoints && typeof draftMetrics === "object" && typeof tweetMetricCheckpoints === "object") {
    // Don't overwrite with lower-view data — return combined object
    return { ...tweetMetricCheckpoints, ...draftMetrics };
  }
  // Return whichever has more info
  if (draftViews >= tmViews) return draftMetrics ?? tweetMetricCheckpoints;
  return tweetMetricCheckpoints;
}

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  // Build where clause for status filter
  const where: Prisma.DraftWhereInput = {};
  if (statusFilter) {
    where.status = statusFilter;
  }

  // Fetch drafts from the database with optional filters
  const dbDrafts = await prisma.draft.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  // Fetch all tweet metrics
  const dbMetrics = await prisma.tweetMetric.findMany();

  // Build lookup: tweetId -> metrics, draftId -> metrics
  const metricsByTweetId: Record<string, (typeof dbMetrics)[number]> = {};
  const metricsByDraftId: Record<string, (typeof dbMetrics)[number]> = {};
  for (const m of dbMetrics) {
    if (m.tweetId) metricsByTweetId[m.tweetId] = m;
    if (m.draftId) metricsByDraftId[m.draftId] = m;
  }

  // Convert to API format
  const drafts = dbDrafts.map(draftToApi);

  // Track which metric entries are already matched to a draft
  const matchedMetricTweetIds = new Set<string>();
  const existingDraftIds = new Set(drafts.map((d) => d.id));

  // Merge metrics into existing drafts
  for (const draft of drafts) {
    const m = metricsByDraftId[draft.id] || (draft.tweetId && metricsByTweetId[draft.tweetId]);
    if (m) {
      // Merge TweetMetric checkpoints with draft.metrics — keep whichever has higher views
      draft.metrics = mergeMetrics(draft.metrics, m.checkpoints);
      if (!draft.tweetUrl && m.url) draft.tweetUrl = m.url;
      if (!draft.postedUrl && m.url) draft.postedUrl = m.url;
      if (!draft.tweetId && m.tweetId) draft.tweetId = m.tweetId;
      if (m.tweetId) matchedMetricTweetIds.add(m.tweetId);
    }
  }

  // Add posted tweets that aren't in drafts yet (posted directly on X).
  // Collected separately so the array never mixes a full Draft row with a
  // partial one; the response concatenates them in the same order as before.
  const syntheticDrafts: SyntheticDraft[] = [];
  for (const m of dbMetrics) {
    const draftIdExists = m.draftId && existingDraftIds.has(m.draftId);
    if (m.tweetId && !matchedMetricTweetIds.has(m.tweetId) && !draftIdExists) {
      syntheticDrafts.push({
        id: m.draftId || `tweet-${m.tweetId}`,
        text: "",
        model: "posted-directly",
        status: "posted",
        type: "tweet",
        feedback: { rating: "posted", reason: "" },
        createdAt: (m.postedAt || new Date()).toISOString(),
        postedAt: (m.postedAt || new Date()).toISOString(),
        tweetUrl: m.url,
        postedUrl: m.url,
        tweetId: m.tweetId,
        metrics: m.checkpoints,
        editHistory: [],
      });
      matchedMetricTweetIds.add(m.tweetId);
    }
  }

  return NextResponse.json([...drafts, ...syntheticDrafts], {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
  } catch (err) {
    console.error("GET /api/x-content error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

// POST: Create a new draft
export async function POST(req: NextRequest) {
  const body = await req.json();

  const draft = await prisma.draft.create({
    data: {
      id: body.id || crypto.randomUUID(),
      text: body.text || body.content || "",
      title: body.title || undefined,
      model: body.model || "manual",
      status: body.status || "pending",
      type: body.type || "tweet",
      category: body.category || undefined,
      hookType: body.hookType || undefined,
      feedbackRating: null,
      feedbackReason: "",
      viralScore: body.viralScore ?? undefined,
      impressionScore: body.impressionScore ?? undefined,
      scheduledDate: body.scheduledDate || null,
      scheduledTime: body.scheduledTime || null,
      visualUrl: body.visualUrl || undefined,
      variantGroup: body.variantGroup || undefined,
      quoteUrl: body.quoteUrl || undefined,
      quoteText: body.quoteText || undefined,
      tweetId: body.tweetId || undefined,
      postedUrl: body.postedUrl || undefined,
      tweetUrl: body.tweetUrl || body.postedUrl || undefined,
      postedAt: body.postedAt ? new Date(body.postedAt) : undefined,
      metrics: body.metrics ?? undefined,
      editHistory: [],
    },
  });

  return NextResponse.json(draftToApi(draft));
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { draftId, text, title, undoRejection, metrics, tweetId, postedUrl, postedAt, status } = body;

  if (!draftId) {
    return NextResponse.json({ error: "draftId required" }, { status: 400 });
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const updateData: Prisma.DraftUpdateInput = {};

  if (undoRejection) {
    updateData.status = "pending";
    updateData.feedbackRating = null;
    updateData.feedbackReason = "";
  }

  if (status) updateData.status = status;
  if (title !== undefined) updateData.title = title;
  if (tweetId) updateData.tweetId = tweetId;
  if (postedUrl) { updateData.postedUrl = postedUrl; updateData.tweetUrl = postedUrl; }
  if (postedAt) updateData.postedAt = new Date(postedAt);
  if (metrics) {
    // Merge with existing metrics rather than overwrite
    const existing = asMetricsBlob(draft.metrics);
    updateData.metrics = { ...existing, ...(metrics as Prisma.InputJsonObject) };
  }

  if (text) {
    if (draft.text !== text) {
      const currentHistory: Prisma.InputJsonValue[] = Array.isArray(
        draft.editHistory,
      )
        ? (draft.editHistory as Prisma.InputJsonValue[])
        : [];
      updateData.editHistory = [
        ...currentHistory,
        {
          original: draft.text,
          edited: text,
          editedAt: new Date().toISOString(),
        },
      ];
      updateData.text = text;
    }
  }

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: updateData,
  });

  return NextResponse.json(draftToApi(updated));
}

export async function DELETE(req: NextRequest) {
  const { draftId } = await req.json();

  if (!draftId) {
    return NextResponse.json({ error: "Draft ID required" }, { status: 400 });
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Safety check: NEVER delete if it would result in 0 drafts
  const count = await prisma.draft.count();
  if (count <= 1) {
    return NextResponse.json({
      error: "Cannot delete the last remaining draft. At least one draft must remain.",
    }, { status: 400 });
  }

  await prisma.draft.delete({ where: { id: draftId } });

  return NextResponse.json({ success: true, message: "Draft deleted" });
}
