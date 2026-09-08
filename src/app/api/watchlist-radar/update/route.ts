import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SECRET = process.env.INTERNAL_API_SECRET || "";

export async function POST(req: Request) {
  if (!SECRET || req.headers.get("x-internal-secret") !== SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!Array.isArray(body.signals))
    return NextResponse.json({ error: "Expected { signals: [] }" }, { status: 400 });

  await prisma.dataStore.upsert({
    where: { key: "watchlist-radar" },
    update: { data: body },
    create: { key: "watchlist-radar", data: body },
  });

  return NextResponse.json({ ok: true, count: body.signals.length });
}
