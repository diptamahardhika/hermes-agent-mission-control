import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/hermes/decisions
 * 
 * Fetch decisions with optional filters.
 * Returns structured Decision objects for rendering in the brief.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse query parameters
    const status = searchParams.get("status"); // pending | approved | dismissed | resolved
    const kind = searchParams.get("kind");     // archive | pin | resolve | confirm
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const excludeDismissed = searchParams.get("exclude_dismissed") === "true";

    // Build filter
    const where = {
      ...(status && { status }),
      ...(kind && { kind }),
      ...(excludeDismissed && { status: { not: "dismissed" } })
    };

    // Fetch decisions
    const decisions = await prisma.decision.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100)
    });

    // Fetch per-status and per-kind counts for filter badges
    const [statusCounts, kindCounts] = await Promise.all([
      prisma.decision.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.decision.groupBy({
        by: ["kind"],
        _count: true,
      }),
    ]);

    const statusMap: Record<string, number> = { pending: 0, approved: 0, dismissed: 0, resolved: 0 };
    for (const g of statusCounts) statusMap[g.status] = g._count;

    const kindMap: Record<string, number> = { archive: 0, pin: 0, resolve: 0, confirm: 0 };
    for (const g of kindCounts) kindMap[g.kind] = g._count;

    return NextResponse.json({
      decisions,
      pendingCount: statusMap.pending || 0,
      total: decisions.length,
      counts: { status: statusMap, kind: kindMap },
    });
  } catch (error) {
    console.error("[Decision] Error fetching decisions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hermes/decisions
 * 
 * Create a new structured decision (for Hermes bridge to emit).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // Validate required fields
    const title = (body.title || "").toString().trim();
    const bodyText = (body.body || "").toString().trim();
    
    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    // Generate deterministic key from title if not provided
    const key = (body.key || generateKeyFromTitle(title)).toString();

    // Create decision
    const decision = await prisma.decision.create({
      data: {
        key,
        title,
        body: bodyText,
        kind: (body.kind || "confirm") as "archive" | "pin" | "resolve" | "confirm",
        actionTarget: body.actionTarget as any,
        actions: (body.actions || ["approve", "dismiss", "open"]) as string[],
        metadata: body.metadata as any
      }
    });

    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (error) {
    console.error("[Decision] Error creating decision:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Note: DELETE for individual decisions is handled by [id]/route.ts

/**
 * Helper: Generate deterministic key from title
 */
function generateKeyFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
