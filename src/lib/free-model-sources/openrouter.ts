import type { ModelCard } from "@/app/api/ai-news/route";

const MODELS_URL = "https://openrouter.ai/api/v1/models";

type ORModel = {
  id: string;
  name: string;
  created?: number;
  description?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
};

function deriveTags(hay: string, mods: string[]): string[] {
  const tags: string[] = [];
  if (/cod(e|ing)|swe-bench|terminal/.test(hay)) tags.push("coding");
  if (mods.includes("image") || /vision|vl\b|multimodal/.test(hay)) tags.push("vision");
  if (/reason|r1|thinking|o[0-9]\b/.test(hay)) tags.push("reasoning");
  if (/agent|tool[- ]call|computer[- ]use/.test(hay)) tags.push("agents");
  if (mods.includes("audio")) tags.push("audio");
  if ((mods.includes("text") || mods.length === 0) && hay.includes("long")) tags.push("long-ctx");
  if (/flash|lite|mini|nano|small|turbo|\d+b\b/.test(hay)) tags.push("fast");
  return tags.slice(0, 3);
}

function toCard(m: ORModel): ModelCard {
  const hay = `${m.id} ${m.name} ${m.description || ""}`.toLowerCase();
  const mods = m.architecture?.input_modalities || [];
  const isFree = m.pricing?.prompt === "0" && m.pricing?.completion === "0";

  return {
    id: m.id,
    name: m.name,
    provider: m.id.split("/")[0] || "unknown",
    source: "openrouter",
    contextLength: m.context_length ?? null,
    free: isFree,
    freeTier: isFree ? "permanent-zero" : "unknown",
    freeTierDetail: isFree ? "$0 on OpenRouter" : undefined,
    createdAt: m.created ? m.created * 1000 : null,
    inputs: m.architecture?.input_modalities || ["text"],
    tags: deriveTags(hay, mods),
    url: `https://openrouter.ai/${m.id}`,
  };
}

export async function fetchOpenRouterModels(): Promise<ModelCard[]> {
  try {
    const res = await fetch(MODELS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data.map(toCard) : [];
  } catch {
    return [];
  }
}