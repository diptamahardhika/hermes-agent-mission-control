import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, CACHE_TTL, invalidateApiCache } from "@/lib/cache";

// Typed NextRequest (not the plain Request the route used before): withCache's
// handler signature is NextRequest because generateCacheKey reads nextUrl.
async function getRequests(req: NextRequest) {
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

// The approval inbox polls this every 5s, so an uncached GET meant two Prisma
// queries per poll. 30s (not the 60s default) keeps a freshly-queued request
// from feeling stuck. Cache keys include the query string (see generateCacheKey),
// so ?take=15 and ?take=50 never share an entry.
const cachedGet = withCache(getRequests, { ttl: CACHE_TTL.VERY_DYNAMIC });

export async function GET(req: Request) {
  return cachedGet(req as NextRequest);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = (body.kind || "oneshot").toString();
  const title = (body.title || kind).toString().slice(0, 200);
  const prompt = body.prompt ? body.prompt.toString().slice(0, 8000) : undefined;
  const sideEffecting = body.sideEffecting === true;
  const origin = (body.origin || "web").toString();

  // Safety check: control.bridge_restart requires explicit confirmation
  if (kind === "control.bridge_restart" && body.confirmed !== true) {
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

  // A just-created request is the one the operator is watching for, so drop
  // the cached GETs instead of making them wait out the 30s TTL. Failing to
  // invalidate only costs staleness, so it must not fail the create.
  await invalidateApiCache(["/api/hermes/requests"]).catch(() => {});
  return NextResponse.json({ request }, { status: 201 });
}
