import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FREELLM_BASE = (process.env.FREELLM_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const FREELLM_EMAIL = process.env.FREELLM_API_EMAIL || "";
const FREELLM_PASSWORD = process.env.FREELLM_API_PASSWORD || "";
const FREELLM_SESSION_TOKEN = process.env.FREELLM_API_SESSION_TOKEN || "";

/**
 * In-flight/resolved login token.
 *
 * `authFetch` is called three times per payload, and this route is hit on every
 * dashboard poll. Without memoization each call performed its own login, so one
 * payload cost 3 logins + 3 data calls, all sequential. Caching the *promise*
 * (not the value) means concurrent callers share a single login rather than
 * each starting their own.
 */
let sessionTokenPromise: Promise<string | null> | null = null;

async function loginForToken(): Promise<string | null> {
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

async function getSessionToken(): Promise<string | null> {
  if (FREELLM_SESSION_TOKEN) return FREELLM_SESSION_TOKEN;
  // A null result (bad credentials, service down) is not cached: a later poll
  // should retry the login rather than stay broken for the process lifetime.
  if (!sessionTokenPromise) {
    sessionTokenPromise = loginForToken().then((t) => {
      if (!t) sessionTokenPromise = null;
      return t;
    });
  }
  return sessionTokenPromise;
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

/**
 * Fetch the FreeLLM analytics payload.
 *
 * Exported so `/api/home` can call it directly instead of making a nested HTTP
 * request back into this same dev server. That self-fetch cost ~467ms nested
 * (versus ~15ms called directly) because the dev server serializes a request
 * that is itself waiting on a request to itself — on the most-polled endpoint
 * on the dashboard. Same shape as `getAgentsData` in `api/agents/route`.
 */
export async function getFreeLLMData() {
  try {
    // The three analytics endpoints are independent, so issue them together.
    // Run in sequence they stacked 3 round-trips (plus logins) into every
    // dashboard poll, which was the bulk of /api/home's latency.
    const [summaryRaw, byModelRaw, timelineRaw] = await Promise.all([
      authFetch("/api/analytics/summary?range=7d"),
      authFetch("/api/analytics/by-model?range=7d"),
      authFetch("/api/analytics/timeline?range=7d&interval=day"),
    ]);

    const summary = summaryRaw as
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

    const byModel = byModelRaw as
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

    const timeline = timelineRaw as
      | Array<{
          timestamp?: string;
          requests?: number;
          successCount?: number;
          failureCount?: number;
          inputTokens?: number;
          outputTokens?: number;
          avgLatencyMs?: number;
        }>
      | null;

    if (!summary && !byModel && !timeline) {
      return { configured: false as const };
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
      avgLatencyMs: row.avgLatencyMs ?? null,
    }));

    return {
      configured: true as const,
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
    };
  } catch {
    return { configured: false as const };
  }
}

export async function GET() {
  return NextResponse.json(await getFreeLLMData());
}
