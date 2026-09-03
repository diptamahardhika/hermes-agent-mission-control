import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/hermes/decisions/:id
 * 
 * Handle user actions on structured decisions from the briefing.
 * 
 * Actions:
 * - approve: Route to Hermes as an agent request for execution
 * - dismiss: Mark decision as dismissed/suppressed from future briefs
 * - open: Return navigation info to related entity
 * 
 * Supports Decision kinds:
 * - archive: Create Hermes task to archive related items
 * - pin: Add metadata to Hermes system (pin config, etc.)
 * - resolve: Mark as resolved in kanban/memory
 * - confirm: Simple confirmation needed
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action || "").toString().toLowerCase();
    const decisionLayer = (body.decisionLayer || "legacy").toString();

    // Validate action
    const validActions = ["approve", "dismiss", "open", "archive", "pin", "resolve"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // Find the decision
    // First try by ID, then by key field
    let decision: any = await prisma.decision.findUnique({
      where: { id }
    });

    // If not found by ID, try by key (deterministic slug)
    if (!decision) {
      decision = await prisma.decision.findFirst({
        where: { key: id }
      });
    }

    if (!decision) {
      // Decision doesn't exist yet - create it for future tracking
      console.log(`[Decision] Creating new decision for action: ${action}, id: ${id}`);
      
      // Parse actionTarget from body if provided
      const actionTarget = body.actionTarget as { type?: string; id?: string; hash?: string } | null;
      
      decision = await prisma.decision.create({
        data: {
          key: id,
          title: `Decision: ${action}`,
          body: JSON.stringify({ action, decisionLayer, ...body }),
          kind: "confirm",
          status: "pending",
          actionTarget: actionTarget as any || undefined,
          actions: ["approve", "dismiss", "open"],
          metadata: { decisionLayer, origin: "web" }
        }
      });
    }

    // Handle action based on type
    const updatedDecision = await handleDecisionAction(decision, action, body);

    // Create event for activity feed
    await prisma.agentEvent.create({
      data: {
        kind: "decision",
        title: `${action.charAt(0).toUpperCase() + action.slice(1)}: ${decision.title}`,
        detail: `Decision ${id} actioned as ${action}`,
        agent: "hermy-hq",
        level: "info",
        meta: {
          decisionId: decision.id,
          decisionKey: decision.key,
          action,
          decisionLayer,
          kind: decision.kind
        }
      }
    });

    return NextResponse.json({
      success: true,
      action,
      decisionId: decision.id,
      decisionKey: decision.key,
      newStatus: updatedDecision?.status ?? decision.status,
      message: `Decision ${action}ed successfully`
    });
  } catch (error) {
    console.error("[Decision] Error handling decision action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hermes/decisions/:id
 * 
 * Permanently delete a decision.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await prisma.decision.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Decision deleted" });
  } catch (error) {
    console.error("[Decision] Error deleting decision:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle the specific decision action
 */
async function handleDecisionAction(
  decision: any,
  action: string,
  body: Record<string, unknown>
): Promise<any> {
  const now = new Date();

  switch (action) {
    case "approve":
      return await approveDecision(decision, body);
    
    case "dismiss":
      return await dismissDecision(decision);
    
    case "archive":
      return await archiveDecision(decision, body);
    
    case "pin":
      return await pinDecision(decision, body);
    
    case "resolve":
      return await resolveDecision(decision, body);
    
    case "open":
      // Return navigation info (frontend handles navigation)
      return decision;
    
    default:
      console.warn(`[Decision] Unknown action: ${action}`);
      return decision;
  }
}

/**
 * Approve decision: Route to Hermes as an agent request
 */
async function approveDecision(
  decision: any,
  body: Record<string, unknown>
) {
  // Determine the kind of work to create
  const kind = decision.kind || "confirm";
  const title = `Approve: ${decision.title}`;
  
  // Build prompt based on decision type
  let prompt = `Decision approved by user: ${decision.body}`;
  
  // If actionTarget has an ID, reference it
  const target = decision.actionTarget as { type?: string; id?: string } | null;
  if (target?.id) {
    prompt += `\n\nRelated entity: ${target.type}#${target.id}`;
  }

  // Create agent request
  const request = await prisma.agentRequest.create({
    data: {
      origin: "web",
      kind: `decision.${kind}`,
      title,
      prompt,
      sideEffecting: kind !== "confirm",
      status: kind === "confirm" ? "approved" : "awaiting_approval",
      decidedAt: new Date()
    }
  });

  // Update decision
  const updated = await prisma.decision.update({
    where: { id: decision.id },
    data: {
      status: "approved",
      decidedAt: new Date(),
      metadata: {
        ...decision.metadata,
        agentRequestId: request.id
      }
    }
  });

  console.log(`[Decision] Approved decision ${decision.key} → AgentRequest ${request.id}`);
  return updated;
}

/**
 * Dismiss decision: Mark as suppressed
 */
async function dismissDecision(decision: any) {
  const updated = await prisma.decision.update({
    where: { id: decision.id },
    data: {
      status: "dismissed",
      decidedAt: new Date()
    }
  });

  console.log(`[Decision] Dismissed decision ${decision.key}`);
  return updated;
}

/**
 * Archive decision: Create task to archive related items
 */
async function archiveDecision(
  decision: any,
  body: Record<string, unknown>
) {
  const title = `Archive: ${decision.title}`;
  let prompt = `Archive the following as requested by user: ${decision.body}`;

  // If actionTarget references a task/request, include it
  const target = decision.actionTarget as { type?: string; id?: string } | null;
  if (target?.id) {
    prompt += `\n\nRelated entity: ${target.type}#${target.id}`;
  }

  // Create agent request for archiving
  const request = await prisma.agentRequest.create({
    data: {
      origin: "web",
      kind: "decision.archive",
      title,
      prompt,
      sideEffecting: true,
      status: "awaiting_approval",
      decidedAt: new Date()
    }
  });

  // Update decision
  const updated = await prisma.decision.update({
    where: { id: decision.id },
    data: {
      status: "approved",
      decidedAt: new Date(),
      metadata: {
        ...decision.metadata,
        agentRequestId: request.id,
        action: "archive"
      }
    }
  });

  console.log(`[Decision] Archived decision ${decision.key} → AgentRequest ${request.id}`);
  return updated;
}

/**
 * Pin decision: Store in memory/config
 */
async function pinDecision(
  decision: any,
  body: Record<string, unknown>
) {
  const title = `Pin: ${decision.title}`;
  let prompt = `Pin the following configuration/metadata as requested: ${decision.body}`;

  // If actionTarget has a path, reference it
  const target = decision.actionTarget as { type?: string; path?: string } | null;
  if (target?.path) {
    prompt += `\n\nTarget path: ${target.path}`;
  }

  // For pin, we might update DataStore instead of creating a request
  // But for consistency, create an agent request
  const request = await prisma.agentRequest.create({
    data: {
      origin: "web",
      kind: "decision.pin",
      title,
      prompt,
      sideEffecting: true,
      status: "awaiting_approval",
      decidedAt: new Date()
    }
  });

  // Update decision
  const updated = await prisma.decision.update({
    where: { id: decision.id },
    data: {
      status: "approved",
      decidedAt: new Date(),
      metadata: {
        ...decision.metadata,
        agentRequestId: request.id,
        action: "pin"
      }
    }
  });

  console.log(`[Decision] Pinned decision ${decision.key} → AgentRequest ${request.id}`);
  return updated;
}

/**
 * Resolve decision: Mark as resolved in kanban/memory
 */
async function resolveDecision(
  decision: any,
  body: Record<string, unknown>
) {
  // Update decision to resolved
  const updated = await prisma.decision.update({
    where: { id: decision.id },
    data: {
      status: "resolved",
      decidedAt: new Date()
    }
  });

  // If actionTarget references a task, update its status
  const target = decision.actionTarget as { type?: string; id?: string } | null;
  if (target?.type === "task" && target?.id) {
    // Update HermesTask if it exists
    await prisma.hermesTask.updateMany({
      where: { id: target.id },
      data: {
        status: "done",
        updatedAt: new Date()
      }
    });
    
    console.log(`[Decision] Resolved decision ${decision.key} → Marked task ${target.id} as done`);
  }

  return updated;
}
