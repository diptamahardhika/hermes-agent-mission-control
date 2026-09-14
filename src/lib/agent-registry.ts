/**
 * Shared agent registry — single source of truth for all agent metadata.
 * Used by src/app/api/agents/route.ts, prisma/seed-all.ts, and any other
 * component that needs agent definitions.
 *
 * When adding a new agent, add it HERE only — this file propagates to
 * all other consumers.
 */

export const AGENTS = [
  { id: 'max', name: 'Max', emoji: '🐺', role: 'Chief of Staff / Orchestrator' },
  { id: 'sage', name: 'Sage', emoji: '🌿', role: 'AI Research Analyst' },
  { id: 'knox', name: 'Knox', emoji: '🔐', role: 'Security & Infrastructure Engineer' },
  { id: 'nova', name: 'Nova', emoji: '⭐', role: 'UI/UX & Frontend Review Agent' },
  { id: 'pixel', name: 'Pixel', emoji: '🎨', role: 'Repo Hygiene & Visual Polish Agent' },
  { id: 'coq', name: 'Coq', emoji: '🐓', role: 'Finance Advisor · Spending & Budget Tracker' },
] as const;

export type Agent = (typeof AGENTS)[number];
