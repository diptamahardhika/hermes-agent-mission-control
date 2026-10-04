import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, CACHE_TTL } from "@/lib/cache";

// Typed NextRequest: withCache's handler signature requires it because
// generateCacheKey reads nextUrl to build the cache key.
async function getActivity(req: NextRequest) {
  const take = Math.min(Number(new URL(req.url).searchParams.get("take") || 40), 100);
  const events = await prisma.agentEvent.findMany({ orderBy: { createdAt: "desc" }, take });
  return NextResponse.json({ events });
}

// Polled every 5-10s by the dashboard. Nothing in this file can invalidate the
// cache (no writer here), so the TTL is the only staleness bound — safe at 60s
// because agent events are append-only history, not live state.
const cachedGet = withCache(getActivity, { ttl: CACHE_TTL.DYNAMIC });

export async function GET(req: Request) {
  return cachedGet(req as NextRequest);
}