export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const ideas = await prisma.youtubeIdea.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(ideas, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json([]);
  }
}

/** Shape of an inbound YouTube idea item (single object or bulk array). */
interface IncomingYoutubeIdea {
  title: string;
  hook?: string | null;
  angle?: string | null;
  hookType?: string | null;
  funnelStage?: string | null;
  status?: string | null;
  rejectedReason?: string | null;
}

/** Bulk-import or create a single idea. Requires internal secret header. */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const items: IncomingYoutubeIdea[] = Array.isArray(body) ? body : [body];

  // Fetch existing titles to deduplicate
  const existing = await prisma.youtubeIdea.findMany({ select: { title: true } });
  const existingTitles = new Set(existing.map((i) => i.title));

  const fresh = items.filter((i) => i.title && !existingTitles.has(i.title));

  for (const idea of fresh) {
    await prisma.youtubeIdea.create({
      data: {
        title: idea.title,
        hook: idea.hook || null,
        angle: idea.angle || null,
        hookType: idea.hookType || null,
        funnelStage: idea.funnelStage || null,
        status: idea.status || "pending",
        rejectedReason: idea.rejectedReason || null,
      },
    });
  }

  return NextResponse.json({ added: fresh.length, skipped: items.length - fresh.length });
}
