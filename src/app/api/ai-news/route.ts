export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

// OpenRouter's public model catalog needs no API key.
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

export type ModelCard = {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  free: boolean;
  createdAt: number | null;
  inputs: string[];
  tags: string[];
};

// Derive use-case tags from the model's own description + capabilities.
function deriveTags(m: ORModel): string[] {
  const d = (m.description || "").toLowerCase();
  const id = m.id.toLowerCase();
  const inputs = m.architecture?.input_modalities || ["text"];
  const tags: string[] = [];

  if (inputs.includes("image") || inputs.includes("video")) tags.push("vision");
  if (inputs.includes("audio")) tags.push("audio");
  if (/\b(coding|code generation|software engineering|programming|agentic coding|swe-bench)\b/.test(d) || /coder|code/.test(id)) tags.push("coding");
  if (/\b(reasoning|reasons|chain.of.thought|thinking|math|aime|complex problem)\b/.test(d)) tags.push("reasoning");
  if (/\b(agents?|agentic|tool (calling|use)|long.horizon|autonomous)\b/.test(d)) tags.push("agents");
  if (/\b(fast|latency|real.time|low.latency|flash|lite|mini|small)\b/.test(d) && !/ultra|pro|max/.test(id)) tags.push("fast");
  if (/\b(long context|1m|million token|large context)\b/.test(d) || (m.context_length ?? 0) >= 1_000_000) tags.push("long-ctx");

  return tags.slice(0, 4);
}

function toCard(m: ORModel): ModelCard {
  return {
    id: m.id,
    name: m.name,
    provider: m.id.split("/")[0] || "unknown",
    contextLength: m.context_length ?? null,
    free: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
    createdAt: m.created ? m.created * 1000 : null,
    inputs: m.architecture?.input_modalities || ["text"],
    tags: deriveTags(m),
  };
}

async function fetchModels(): Promise<ModelCard[]> {
  try {
    const res = await fetch(MODELS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data.map(toCard) : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const models = await fetchModels();
  if (!models.length) {
    return NextResponse.json({ newModels: [], freeModels: [], totalFree: 0, fetchedAt: null });
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newModels = models
    .filter(m => m.createdAt && m.createdAt > thirtyDaysAgo)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 8);

  const freeModels = models
    .filter(m => m.free)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);

  return NextResponse.json({
    newModels,
    freeModels,
    totalFree: models.filter(m => m.free).length,
    fetchedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, no-cache" } });
}
