import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // e.g. "awaiting_approval"
  const kind = url.searchParams.get("kind"); // e.g. "briefing.generate"
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
