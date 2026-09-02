import type { ModelCard } from "@/app/api/ai-news/route";
import { fetchOpenRouterModels } from "./openrouter";
import { fetchStaticCatalogModels } from "./static-catalog";

/**
 * Tier preference order for deduping — higher = more free.
 * permanent-zero > quota > no-card > trial > unknown
 */
const TIER_ORDER: Record<ModelCard["freeTier"], number> = {
  "permanent-zero": 5,
  "quota": 4,
  "no-card": 3,
  "trial": 2,
  "unknown": 1,
};

function dedupeKey(m: ModelCard): string {
  return `${m.provider.toLowerCase()}/${m.name.toLowerCase()}`;
}

export async function fetchAllModels(): Promise<ModelCard[]> {
  console.log("[fetchAllModels] Starting...");
  const results = await Promise.allSettled([
    fetchOpenRouterModels(),
    fetchStaticCatalogModels(),
  ]);

  console.log("[fetchAllModels] Results:", results.map(r => r.status === "fulfilled" ? r.value.length : r.reason));

  const all = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  console.log("[fetchAllModels] Total models before dedupe:", all.length);
  console.log("[fetchAllModels] Sources:", [...new Set(all.map(m => m.source))]);

  // Dedupe by provider + name, preferring the "most free" tier
  const seen = new Map<string, ModelCard>();
  for (const m of all) {
    const key = dedupeKey(m);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, m);
    } else if (TIER_ORDER[m.freeTier] > TIER_ORDER[existing.freeTier]) {
      seen.set(key, m);
    }
  }

  const result = Array.from(seen.values());
  console.log("[fetchAllModels] Total models after dedupe:", result.length);
  console.log("[fetchAllModels] Sources after dedupe:", [...new Set(result.map(m => m.source))]);
  return result;
}