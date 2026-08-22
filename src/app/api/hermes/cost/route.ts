import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DaySnap = { date: string; totalTokens?: number | null };

export async function GET() {
  const [row, hist] = await Promise.all([
    prisma.dataStore.findUnique({ where: { key: "hermes-cost" } }),
    prisma.dataStore.findUnique({ where: { key: "hermes-cost-history" } }),
  ]);
  const cur = (row?.data ?? {}) as Record<string, unknown>;
  const rawDays = ((hist?.data as { days?: DaySnap[] } | null)?.days ?? []) as DaySnap[];

  // The bridge snapshots each day's trailing-7-day totals; day-over-day deltas
  // between consecutive snapshots approximate daily usage.
  const days = rawDays
    .map((d, i) => {
      const prev = i > 0 ? rawDays[i - 1] : undefined;
      const tokens =
        prev?.totalTokens != null && d.totalTokens != null
          ? Math.max(0, d.totalTokens - prev.totalTokens)
          : 0;
      return { date: d.date, tokens };
    })
    .filter((d) => d.tokens > 0 || d.date === rawDays[rawDays.length - 1]?.date);

  return NextResponse.json({
    summary: cur.summary ?? null,
    byModel: Array.isArray(cur.byModel) ? cur.byModel : [],
    totalCost: null,
    totalTokens: cur.totalTokens ?? null,
    inputTokens: cur.inputTokens ?? null,
    outputTokens: cur.outputTokens ?? null,
    sessions: cur.sessions ?? null,
    messages: cur.messages ?? null,
    toolCalls: cur.toolCalls ?? null,
    days,
    syncedAt: cur.syncedAt ?? null,
  });
}
