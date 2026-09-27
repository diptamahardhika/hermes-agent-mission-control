import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Read messages for a specific agent (or all)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const unreadOnly = searchParams.get("unread") === "true";

  const where: Prisma.AgentBusMessageWhereInput = {};

  if (agent) {
    where.OR = [{ toAgent: agent }, { toAgent: "all" }];
  }
  if (unreadOnly) {
    where.read = false;
  }

  const messages = await prisma.agentBusMessage.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  // Reverse to return in chronological order (oldest first, like the original .slice(-50))
  const formatted = messages.reverse().map((m) => ({
    id: m.id,
    from: m.fromAgent,
    to: m.toAgent,
    type: m.type,
    content: m.content,
    metadata: m.metadata || {},
    timestamp: m.timestamp.toISOString(),
    read: m.read,
  }));

  return NextResponse.json({ messages: formatted });
}

// POST: Send a message between agents
export async function POST(req: Request) {
  const body = await req.json();

  const msg = await prisma.agentBusMessage.create({
    data: {
      fromAgent: body.from || "unknown",
      toAgent: body.to || "max",
      type: body.type || "insight",
      content: body.content || "",
      metadata: body.metadata || {},
      read: false,
    },
  });

  return NextResponse.json({ ok: true, id: msg.id });
}

// PATCH: Mark messages as read
export async function PATCH(req: Request) {
  const { messageIds } = await req.json();

  await prisma.agentBusMessage.updateMany({
    where: { id: { in: messageIds } },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
