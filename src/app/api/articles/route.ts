export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

// GET /api/articles?status=X — list articles, filter by status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const where: Prisma.ArticleWhereInput = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    const articles = await prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(articles, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.error("GET /api/articles error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

// POST /api/articles — create article
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const article = await prisma.article.create({
      data: {
        id: body.id || crypto.randomUUID(),
        title: body.title || "",
        body: body.body || "",
        track: body.track || "local-viral",
        status: body.status || "idea",
        qtTweet: body.qtTweet || null,
        qtUrl: body.qtUrl || null,
        heroImageUrl: body.heroImageUrl || null,
        heroImageHtml: body.heroImageHtml || null,
        inspirationUrls: body.inspirationUrls || null,
        themes: body.themes || null,
        scheduledDate: body.scheduledDate || null,
        postedAt: body.postedAt ? new Date(body.postedAt) : null,
        postedUrl: body.postedUrl || null,
        impressions: body.impressions ?? null,
        likes: body.likes ?? null,
        bookmarks: body.bookmarks ?? null,
      },
    });

    return NextResponse.json(article);
  } catch (err) {
    console.error("POST /api/articles error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

// PATCH /api/articles — update article (body: { id, ...fields })
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const updateData: Prisma.ArticleUpdateInput = {};

    if (fields.title !== undefined) updateData.title = fields.title;
    if (fields.body !== undefined) updateData.body = fields.body;
    if (fields.track !== undefined) updateData.track = fields.track;
    if (fields.status !== undefined) updateData.status = fields.status;
    if (fields.qtTweet !== undefined) updateData.qtTweet = fields.qtTweet;
    if (fields.qtUrl !== undefined) updateData.qtUrl = fields.qtUrl;
    if (fields.heroImageUrl !== undefined) updateData.heroImageUrl = fields.heroImageUrl;
    if (fields.heroImageHtml !== undefined) updateData.heroImageHtml = fields.heroImageHtml;
    if (fields.inspirationUrls !== undefined) updateData.inspirationUrls = fields.inspirationUrls;
    if (fields.themes !== undefined) updateData.themes = fields.themes;
    if (fields.scheduledDate !== undefined) updateData.scheduledDate = fields.scheduledDate;
    if (fields.postedAt !== undefined) updateData.postedAt = fields.postedAt ? new Date(fields.postedAt) : null;
    if (fields.postedUrl !== undefined) updateData.postedUrl = fields.postedUrl;
    if (fields.impressions !== undefined) updateData.impressions = fields.impressions;
    if (fields.likes !== undefined) updateData.likes = fields.likes;
    if (fields.bookmarks !== undefined) updateData.bookmarks = fields.bookmarks;

    const updated = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/articles error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

// DELETE /api/articles — delete article (body: { id })
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    await prisma.article.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Article deleted" });
  } catch (err) {
    console.error("DELETE /api/articles error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
