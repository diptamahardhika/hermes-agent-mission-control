import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET: list content requests
export async function GET() {
  const requests = await prisma.contentRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(requests);
}

// POST: create a new content request
export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const request = await prisma.contentRequest.create({
    data: {
      prompt: prompt.trim(),
      status: "pending",
    },
  });

  // TODO: Trigger file paths won't exist on Vercel — needs a different mechanism (e.g. queue, webhook)
  try {
    const triggerDir = path.join("./data", "triggers");
    fs.mkdirSync(triggerDir, { recursive: true });
    fs.writeFileSync(path.join(triggerDir, `request-${request.id}.json`), JSON.stringify({
      type: "request",
      requestId: request.id,
      prompt: request.prompt,
      createdAt: new Date().toISOString(),
    }, null, 2));
  } catch {}

  return NextResponse.json(request);
}

// PATCH: update request status (used by Sage when processing)
export async function PATCH(req: NextRequest) {
  const { requestId, status, resultDraftIds } = await req.json();

  const existing = await prisma.contentRequest.findUnique({ where: { id: requestId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Prisma.ContentRequestUpdateInput = {};
  if (status) updateData.status = status;
  if (resultDraftIds) updateData.resultDraftIds = resultDraftIds;
  if (status === "done") updateData.completedAt = new Date();

  const updated = await prisma.contentRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  return NextResponse.json(updated);
}
