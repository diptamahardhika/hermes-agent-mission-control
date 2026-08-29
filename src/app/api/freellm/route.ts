import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FREELLM_BASE = (process.env.FREELLM_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const FREELLM_EMAIL = process.env.FREELLM_API_EMAIL || "";
const FREELLM_PASSWORD = process.env.FREELLM_API_PASSWORD || "";
const FREELLM_SESSION_TOKEN = process.env.FREELLM_API_SESSION_TOKEN || "";

async function getSessionToken(): Promise<string | null> {
  if (FREELLM_SESSION_TOKEN) return FREELLM_SESSION_TOKEN;
  if (!FREELLM_EMAIL || !FREELLM_PASSWORD) return null;

  try {
    const res = await fetch(`${FREELLM_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: FREELLM_EMAIL, password: FREELLM_PASSWORD }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token || null;
  } catch {
    return null;
  }
}

async function authFetch(path: string): Promise<unknown> {
  const token = await getSessionToken();
  if (!token) return null;
  const res = await fetch(`${FREELLM_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    const summary = (await authFetch("/api/analytics/summary?range=7d")) as
      | {
          totalRequests?: number;
          totalInputTokens?: number;
          totalOutputTokens?: number;
          successRate?: number;
          avgLatencyMs?: number;
          firstRequestAt?: string;
          lifetimeTotalRequests?: number;
          estimatedCostSavings?: number;
          pinnedRequests?: number;
          pinHonoredRequests?: number;
          requestTypeCounts?: Record<string, number>;
        }
      | null;

    const byModel = (await authFetch("/api/analytics/by-model?range=7d")) as
      | Array<{
          modelId?: string;
          displayName?: string;
          platform?: string;
          providerId?: string;
          requests?: number;
          totalInputTokens?: number;
          totalOutputTokens?: number;
          successRate?: number;
          avgLatencyMs?: number;
          pinnedRequests?: number;
          estimatedCost?: number;
        }>
      | null;

    const timeline = (await authFetch("/api/analytics/timeline?range=7d&interval=day")) as
      | Array<{
          timestamp?: string;
          requests?: number;
          successCount?: number;
          failureCount?: number;
          inputTokens?: number;
          outputTokens?: number;
        }>
      | null;

    if (!summary && !byModel && !timeline) {
      return NextResponse.json({ configured: false });
    }

    const totalTokens =
      (summary?.totalInputTokens || 0) + (summary?.totalOutputTokens || 0);

    const modelRows = (byModel || [])
      .map((row) => {
        const inputTokens = row.totalInputTokens || 0;
        const outputTokens = row.totalOutputTokens || 0;
        const tokens = inputTokens + outputTokens;
        return {
          model: row.displayName || row.modelId || "unknown",
          provider: row.providerId || row.platform || "unknown",
          requests: row.requests || 0,
          inputTokens,
          outputTokens,
          cacheReadTokens: 0,
          tokens,
          successRate: row.successRate ?? null,
          avgLatencyMs: row.avgLatencyMs ?? null,
          pinnedRequests: row.pinnedRequests ?? 0,
          estimatedCost: row.estimatedCost ?? null,
        };
      })
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 7);

    const days = (timeline || []).map((row) => ({
      date: row.timestamp || "",
      requests: row.requests || 0,
      tokens: (row.inputTokens || 0) + (row.outputTokens || 0),
      successCount: row.successCount ?? null,
      failureCount: row.failureCount ?? null,
    }));

    return NextResponse.json({
      configured: true,
      syncedAt: new Date().toISOString(),
      totalRequests: summary?.totalRequests || 0,
      lifetimeTotalRequests: summary?.lifetimeTotalRequests ?? null,
      totalTokens,
      inputTokens: summary?.totalInputTokens || 0,
      outputTokens: summary?.totalOutputTokens || 0,
      successRate: summary?.successRate || 0,
      avgLatencyMs: summary?.avgLatencyMs || 0,
      p50LatencyMs: null,
      p95LatencyMs: null,
      avgTtfbMs: null,
      estimatedCostSavings: summary?.estimatedCostSavings ?? null,
      pinnedRequests: summary?.pinnedRequests ?? null,
      pinHonoredRequests: summary?.pinHonoredRequests ?? null,
      requestTypeCounts: summary?.requestTypeCounts ?? null,
      firstRequestAt: summary?.firstRequestAt || null,
      byModel: modelRows,
      days,
    });
  } catch {
    return NextResponse.json({ configured: false });
  }
}
