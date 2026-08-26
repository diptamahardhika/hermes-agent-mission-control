import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const row = await prisma.dataStore.findUnique({
    where: { key: "omniroute-cost" },
  });
  const cur = (row?.data ?? {}) as Record<string, any>;

  return NextResponse.json({
    syncedAt: cur.syncedAt ?? null,
    totalTokens: cur.totalTokens ?? null,
    inputTokens: cur.inputTokens ?? null,
    outputTokens: cur.outputTokens ?? null,
    cacheReadTokens: cur.cacheReadTokens ?? 0,
    totalCalls: cur.totalCalls ?? 0,
    byModel: Array.isArray(cur.byModel) ? cur.byModel : [],
    days: Array.isArray(cur.days) ? cur.days : [],
  });
}
