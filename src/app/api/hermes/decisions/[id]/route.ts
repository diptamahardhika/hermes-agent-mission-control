import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/hermes/decisions/:id
 * 
 * Handle user actions on structured decisions from the briefing.
 * 
 * Actions:
 * - approve: Mark decision as approved (route to Hermes for execution)
 * - dismiss: Mark decision as dismissed/suppressed
 * - open: Navigate to related entity (task, request, path)
 * 
 * This is a stub for Phase 2.1 - actual routing logic will be added in Phase 2.2
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action || "").toString().toLowerCase();

    // Validate action
    const validActions = ["approve", "dismiss", "open"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // Find or create decision record in dataStore
    // Note: We don't have a dedicated Decision model yet, so we'll use dataStore
    const decisionKey = `decision:${id}`;
    
    // Check if decision already exists
    const existing = await prisma.dataStore.findUnique({
      where: { key: decisionKey }
    });

    const decisionData = existing?.data || {
      id,
      action,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // For now, just log and return success (stub)
    console.log(`[Decision] Action "${action}" on decision "${id}"`, {
      body,
      existing: !!existing
    });

    // TODO (Phase 2.2): Implement actual routing logic
    // - archive: Trigger Hermes to archive related task/request
    // - pin: Add metadata to Hermes system
    // - resolve: Mark as resolved in kanban/memory
    // - approve: Queue Hermes to execute the decision
    // - dismiss: Suppress the decision from future briefings
    // - open: Return navigation URL/hash

    return NextResponse.json({
      success: true,
      action,
      decisionId: id,
      message: `Decision ${action}ped (stub)`
    });
  } catch (error) {
    console.error("[Decision] Error handling decision action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
