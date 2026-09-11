import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const kind = url.searchParams.get("kind");
  const take = Math.min(Number(url.searchParams.get("take") || 50), 200);
  const where = {
    ...(status ? { status: { in: status.split(",") } } : {}),
    ...(kind ? { kind } : {}),
  };
  const requests = await prisma.agentRequest.findMany({
    where, orderBy: { createdAt: "desc" }, take,
  });
  const pending = await prisma.agentRequest.count({ where: { status: "awaiting_approval" } });
  return NextResponse.json({ requests, pending });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = (body.kind || "oneshot").toString();
  const title = (body.title || kind).toString().slice(0, 200);
  const prompt = body.prompt ? body.prompt.toString().slice(0, 8000) : undefined;
  const sideEffecting = Boolean(body.sideEffecting);
  const origin = (body.origin || "web").toString();

  // Safety check: control.bridge_restart requires explicit confirmation
  if (kind === "control.bridge_restart" && !body.confirmed) {
    return NextResponse.json(
      { error: "control.bridge_restart requires confirmed: true in body" },
      { status: 400 }
    );
  }

  const request = await prisma.agentRequest.create({
    data: {
      origin,
      kind,
      title,
      prompt,
      sideEffecting,
      status: "queued",
    },
  });
  return NextResponse.json({ request }, { status: 201 });
}
