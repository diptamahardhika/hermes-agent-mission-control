import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DaySnap = { date: string; tokens?: number | null };

export async function GET() {
  const [row, hist] = await Promise.all([
    prisma.dataStore.findUnique({ where: { key: "hermes-cost" } }),
    prisma.dataStore.findUnique({ where: { key: "hermes-cost-history" } }),
  ]);
  const cur = (row?.data ?? {}) as Record<string, unknown>;
  const rawDays = ((hist?.data as { days?: DaySnap[] } | null)?.days ?? []) as DaySnap[];

  // Bridge now stores real daily token counts (by session started_at), not
  // trailing-7-day rolling totals. Serve them directly.
  const days = rawDays
    .filter((d) => d.tokens != null)
    .map((d) => ({ date: d.date, tokens: d.tokens as number }));

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
    userMessages: cur.userMessages ?? null,
    activeTime: cur.activeTime ?? null,
    avgSession: cur.avgSession ?? null,
    avgMsgsPerSession: cur.avgMsgsPerSession ?? null,
    period: cur.period ?? null,
    unknownSessions: cur.unknownSessions ?? null,
    platforms: Array.isArray(cur.platforms) ? cur.platforms : [],
    tools: Array.isArray(cur.tools) ? cur.tools : [],
    skills: Array.isArray(cur.skills) ? cur.skills : [],
    toolsMore: cur.toolsMore ?? null,
    days,
    syncedAt: cur.syncedAt ?? null,
  });
}
