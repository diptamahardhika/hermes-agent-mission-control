"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, Gauge, Waypoints } from "lucide-react";
import { Panel, SectionHeader, Pill, EmptyState, Eyebrow } from "@/components/ui/kit";

// ── Types ─────────────────────────────────────────────────
type RunStatus =
  | "queued"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "done"
  | "failed"
  | "rejected";

interface Req {
  id: string;
  origin: string;
  kind: string;
  title: string;
  prompt: string | null;
  sideEffecting: boolean;
  status: RunStatus;
  result: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface ModelUsage {
  model: string;
  tokens?: number;
  cost?: number;
  calls?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

interface PlatformUsage {
  name: string;
  sessions: number;
  messages: number;
  tokens: number;
}
interface ToolUsage {
  name: string;
  calls: number;
  pct: number;
}
interface SkillUsage {
  name: string;
  loads: number;
  edits: number;
  lastUsed: string;
}

interface Cost {
  summary?: string | null;
  byModel?: ModelUsage[];
  totalCost?: number | null;
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  sessions?: number | null;
  messages?: number | null;
  toolCalls?: number | null;
  userMessages?: number | null;
  activeTime?: string | null;
  avgSession?: string | null;
  avgMsgsPerSession?: number | null;
  period?: string | null;
  unknownSessions?: number | null;
  platforms?: PlatformUsage[];
  tools?: ToolUsage[];
  skills?: SkillUsage[];
  toolsMore?: number | null;
  syncedAt?: string | null;
}

interface OmniCost {
  syncedAt?: string | null;
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens: number;
  totalCalls: number;
  byModel: {
    model: string;
    provider: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    calls: number;
  }[];
  days: { date: string; tokens: number }[];
}

// ── Helpers ───────────────────────────────────────────────
function timeAgo(d: string | null): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  if (Number.isNaN(diff)) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function duration(start: string | null, finish: string | null): string {
  if (!start || !finish) return "—";
  const ms = new Date(finish).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalS = Math.round(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString("en-US");
}
function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: n < 100 ? 2 : 0,
    maximumFractionDigits: n < 100 ? 2 : 0,
  })}`;
}

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

// ── Status → tone / dot ───────────────────────────────────
type Tone = "neutral" | "up" | "down" | "warn" | "accent";
const STATUS_TONE: Record<RunStatus, Tone> = {
  queued: "neutral",
  awaiting_approval: "warn",
  approved: "accent",
  running: "accent",
  done: "up",
  failed: "down",
  rejected: "neutral",
};
const STATUS_LABEL: Record<RunStatus, string> = {
  queued: "Queued",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  running: "Running",
  done: "Done",
  failed: "Failed",
  rejected: "Rejected",
};
function toneVar(t: Tone): string {
  return t === "neutral" ? "var(--text-3)" : `var(--${t})`;
}

// ── Status dot ────────────────────────────────────────────
function StatusDot({ status, reduce }: { status: RunStatus; reduce: boolean }) {
  const tone = STATUS_TONE[status];
  const color = toneVar(tone);
  const pulse = status === "running" && !reduce;
  return (
    <span className="relative flex w-1.5 h-1.5 shrink-0">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full animate-ping"
          style={{ background: `color-mix(in srgb, ${color} 60%, transparent)` }}
        />
      )}
      <span
        className="relative inline-flex w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}

// ── Insights (native HTML rendering of the parsed insights data) ──────────
function Insights({ cost }: { cost: Cost }) {
  const platforms = cost.platforms ?? [];
  const tools = cost.tools ?? [];
  const skills = cost.skills ?? [];
  const pMax = Math.max(...platforms.map((p) => p.tokens), 1);
  const overview: [string, string | number | null][] = [
    ["Sessions", cost.sessions ?? null],
    ["Messages", cost.messages ?? null],
    ["Tool calls", cost.toolCalls ?? null],
    ["User msgs", cost.userMessages ?? null],
    ["Active", cost.activeTime ?? null],
    ["Avg session", cost.avgSession ?? null],
  ];
  return (
    <div className="mt-5 pt-4 border-t border-[var(--line)] space-y-5">
      {cost.period && (
        <div className="num text-[11px] text-[var(--hq-text-ghost)]">{cost.period}</div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-3">
        {overview.map(([label, v]) =>
          v == null ? null : (
            <div key={label}>
              <div className="num text-[15px] font-semibold text-[var(--text)] leading-none">{v}</div>
              <div className="eyebrow mt-1.5">{label}</div>
            </div>
          )
        )}
      </div>
      {cost.unknownSessions != null && cost.unknownSessions > 0 && (
        <p className="text-[11px] text-[var(--hq-text-ghost)]">
          {cost.unknownSessions} session(s) without pricing data
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-x-10 gap-y-5">
        {platforms.length > 0 && (
          <div className="min-w-0">
            <Eyebrow>Platforms</Eyebrow>
            <div className="mt-2.5 flex flex-col gap-2">
              {platforms.map((p) => (
                <div key={p.name} className="flex items-center gap-3 min-w-0">
                  <span className="text-[12px] text-[var(--text-2)] w-16 shrink-0 truncate">{p.name}</span>
                  <div className="flex-1 h-[6px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(2, (p.tokens / pMax) * 100)}%`, background: "#38bdf8", opacity: 0.85 }}
                    />
                  </div>
                  <span className="num text-[11px] text-[var(--text-3)] w-14 text-right shrink-0">{fmtTokens(p.tokens)}</span>
                  <span className="num text-[10px] text-[var(--hq-text-ghost)] w-8 text-right shrink-0 hidden sm:block" title={`${p.sessions} sessions`}>
                    {p.sessions}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tools.length > 0 && (
          <div className="min-w-0">
            <Eyebrow>Top tools</Eyebrow>
            <div className="mt-2.5 flex flex-col gap-2">
              {tools.map((t) => (
                <div key={t.name} className="flex items-center gap-3 min-w-0">
                  <span className="text-[12px] text-[var(--text-2)] w-28 truncate">{t.name}</span>
                  <div className="flex-1 h-[6px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(1, t.pct)}%`, background: "#a78bfa", opacity: 0.85 }}
                    />
                  </div>
                  <span className="num text-[11px] text-[var(--text-3)] w-12 text-right shrink-0">{t.calls.toLocaleString("en-US")}</span>
                  <span className="num text-[10px] text-[var(--hq-text-ghost)] w-9 text-right shrink-0">{t.pct}%</span>
                </div>
              ))}
              {cost.toolsMore != null && (
                <p className="text-[10px] text-[var(--hq-text-ghost)]">+ {cost.toolsMore} more tools</p>
              )}
            </div>
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div className="min-w-0">
          <Eyebrow>Top skills</Eyebrow>
          <div className="mt-2.5 grid md:grid-cols-2 gap-x-10 gap-y-1.5">
            {skills.map((s) => (
              <div key={s.name} className="flex items-baseline gap-2 min-w-0">
                <span className="text-[11.5px] text-[var(--text-2)] truncate flex-1">{s.name}</span>
                <span className="num text-[11px] text-[var(--text-3)] shrink-0 whitespace-nowrap">
                  {s.loads} loads{s.edits > 0 ? ` · ${s.edits} edits` : ""}
                </span>
                <span className="num text-[10px] text-[var(--hq-text-ghost)] w-12 text-right shrink-0">{s.lastUsed}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Usage strip ───────────────────────────────────────────
function UsageStrip({ cost }: { cost: Cost | null }) {
  const byModel = cost?.byModel ?? [];
  const hasAny =
    !!cost &&
    (!!cost.summary ||
      byModel.length > 0 ||
      cost.totalCost != null ||
      cost.totalTokens != null);

  if (!hasAny) {
    return (
      <Panel className="p-5">
        <p className="text-[13px] text-[var(--text-3)] flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5" />
          Usage syncing from Hermes…
        </p>
      </Panel>
    );
  }

  // Sorted most→least usage, always — independent of how the store happens to
  // hold the rows. Bars use a sqrt scale: linear widths vanish next to the
  // dominant model (60%+ of total), sqrt keeps every model visible while
  // preserving the ranking read.
  const hasSplit = byModel.some((m) => m.inputTokens != null && m.outputTokens != null);
  const modelTotal = (m: ModelUsage) => {
    if (m.inputTokens != null && m.outputTokens != null)
      return m.inputTokens + m.outputTokens + (m.cacheReadTokens ?? 0);
    return m.tokens ?? m.cost ?? m.calls ?? 0;
  };
  const sorted = [...byModel].sort((a, b) => (modelTotal(b) ?? 0) - (modelTotal(a) ?? 0));
  const max = byModel.reduce((mx, m) => Math.max(mx, modelTotal(m) ?? 0), 0) || 1;
  const grand = byModel.reduce((s, m) => s + (modelTotal(m) ?? 0), 0) || 1;

  return (
    <Panel className="p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <Eyebrow>Total cost</Eyebrow>
          <div className="num font-semibold text-[26px] tracking-[-0.02em] text-[var(--text)] leading-none mt-2">
            {cost?.totalCost != null ? fmtUsd(cost.totalCost) : "—"}
          </div>
        </div>
        <div>
          <Eyebrow>Total tokens</Eyebrow>
          <div className="num font-semibold text-[26px] tracking-[-0.02em] text-[var(--text)] leading-none mt-2">
            {cost?.totalTokens != null ? fmtTokens(cost.totalTokens) : "—"}
          </div>
        </div>
        <div>
          <Eyebrow>Synced</Eyebrow>
          <div className="num text-[13px] text-[var(--text-2)] mt-2.5">
            {timeAgo(cost?.syncedAt ?? null)}
          </div>
        </div>
      </div>

      {cost && (cost.platforms?.length || cost.tools?.length || cost.skills?.length) ? (
        <Insights cost={cost} />
      ) : cost?.summary ? (
        <div className="mt-4 overflow-x-auto">
          <pre className="w-max mx-auto font-mono text-[clamp(11px,2cqw,17px)] leading-snug text-[var(--text-2)] whitespace-pre">
            {cost.summary}
          </pre>
        </div>
      ) : null}

      {(() => {
        // Aggregate in/cached/out — cache summed from per-model rows so the
        // aggregate bar is consistent with the "By model" breakdown below.
        const cacheTotal = byModel.reduce((s, m) => s + (m.cacheReadTokens ?? 0), 0);
        const input = cost?.inputTokens ?? 0;
        const output = cost?.outputTokens ?? 0;
        const sum = input + output + cacheTotal;
        if (!cost || sum === 0) return null;
        const seg = (v: number) => `${(v / sum) * 100}%`;
        return (
          <div className="mt-4">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
              {cacheTotal > 0 && <div style={{ width: seg(cacheTotal), background: "#f472b6", opacity: 0.8 }} />}
              <div style={{ width: seg(input), background: "#a78bfa" }} />
              <div style={{ width: seg(output), background: "#38bdf8" }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] num text-[var(--hq-text-ghost)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#a78bfa" }} />
                in {fmtTokens(input)}
              </span>
              <span className="flex items-center gap-1.5">
                {cacheTotal > 0 && (
                  <>
                    cached {fmtTokens(cacheTotal)}
                    <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#f472b6" }} />
                  </>
                )}
              </span>
              <span className="flex items-center gap-1.5">
                out {fmtTokens(output)}
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#38bdf8" }} />
              </span>
            </div>
          </div>
        );
      })()}

      {byModel.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Eyebrow>By model</Eyebrow>
            {hasSplit && (
              <span className="num text-[10px] text-[var(--text-3)] inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#a78bfa" }} />
                  in
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#38bdf8" }} />
                  out
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#f472b6" }} />
                  cached
                </span>
                <span className="opacity-60">· √ scale</span>
              </span>
            )}
          </div>
          {sorted.map((m) => {
            const cacheRead = m.cacheReadTokens ?? 0;
            const split = m.inputTokens != null && m.outputTokens != null && m.inputTokens + m.outputTokens + cacheRead > 0;
            const total = modelTotal(m) ?? 0;
            const widthPct = Math.max(2, Math.round(Math.sqrt(total / max) * 100));
            const sharePct = Math.round((total / grand) * 100);
            const knownSum = split ? m.inputTokens! + m.outputTokens! + cacheRead : 0;
            const segOf = (v: number) => (knownSum > 0 ? (v / knownSum) * 100 : 0);
            // Provider label: use the id prefix when present ("nous/..." -> nous),
            // otherwise match known model families to their usual route.
            const KNOWN_PROVIDERS: [RegExp, string][] = [
              [/^ox-alpha/i, "openrouter"],
              [/nemotron/i, "nvidia"],
              [/solar-pro/i, "upstage"],
              [/deepseek/i, "deepseek"],
              [/glm|z-ai/i, "z.ai"],
              [/qwen/i, "qwen"],
              [/gemma/i, "google"],
              [/llama/i, "meta"],
              [/mistral|magistral/i, "mistral"],
              [/claude/i, "anthropic"],
              [/gpt|o[34](-|$)/i, "openai"],
            ];
            let provider = "";
            if (m.model.includes("/")) provider = m.model.split("/")[0];
            else for (const [re, p] of KNOWN_PROVIDERS) { if (re.test(m.model)) { provider = p; break; } }
            return (
              <div key={m.model} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[12px] text-[var(--text-2)] w-32 min-w-0 truncate sm:w-44">
                  {m.model}
                  {provider && <span className="text-[10px] text-[var(--text-3)]"> | {provider}</span>}
                </span>
                <div className="flex-1 h-[6px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="flex h-full rounded-full overflow-hidden transition-all duration-700 ease-out"
                    style={{ width: `${widthPct}%` }}
                  >
                    {split ? (
                      <>
                        {cacheRead > 0 && (
                          <div
                            className="h-full"
                            style={{ width: `${segOf(cacheRead)}%`, background: "#f472b6", opacity: 0.8 }}
                            title={`cached: ${fmtTokens(cacheRead)}`}
                          />
                        )}
                        <div className="h-full" style={{ width: `${segOf(m.inputTokens!)}%`, background: "#a78bfa", opacity: 0.9 }} />
                        <div className="h-full" style={{ width: `${segOf(m.outputTokens!)}%`, background: "#38bdf8", opacity: 0.85 }} />
                      </>
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          // Neutral: total known, in/out split unknown.
                          background: "color-mix(in srgb, var(--text-2) 50%, transparent)",
                        }}
                      />
                    )}
                  </div>
                </div>
                <span className="num text-[11px] text-[var(--text-3)] w-full sm:w-48 sm:shrink-0 sm:text-right tabular-nums whitespace-nowrap">
                  {split ? (
                    <>
                      <span style={{ color: "#a78bfa" }}>in</span> {fmtTokens(m.inputTokens!)}
                      {cacheRead > knownSum * 0.01 && (
                        <>{" "}<span style={{ color: "#f472b6" }}>·c</span> {fmtTokens(cacheRead)}</>
                      )}
                      {" "}
                      <span style={{ color: "#38bdf8" }}>out</span> {fmtTokens(m.outputTokens!)}
                    </>
                  ) : m.tokens != null
                    ? `${fmtTokens(m.tokens)} tok`
                    : m.cost != null
                      ? fmtUsd(m.cost)
                      : m.calls != null
                        ? `${m.calls} calls`
                        : "—"}
                  <span className="text-[var(--text-2)] ml-2">{sharePct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── OmniRoute usage strip — sibling of UsageStrip, teal/cyan palette ──────
const OMNI_C = { input: "#22d3ee", cache: "#5eead4", output: "#a5f3fc", accent: "#2dd4bf" };

function OmniUsageStrip({ omni }: { omni: OmniCost | null }) {
  const byModel = omni?.byModel ?? [];
  const hasAny = !!omni && (byModel.length > 0 || omni.totalTokens != null);

  if (!hasAny) {
    return (
      <Panel className="p-5">
        <p className="text-[13px] text-[var(--text-3)] flex items-center gap-2">
          <Waypoints className="w-3.5 h-3.5" style={{ color: OMNI_C.accent }} />
          Usage syncing from OmniRoute…
        </p>
      </Panel>
    );
  }

  const modelTotal = (m: OmniCost["byModel"][0]) =>
    m.inputTokens + m.outputTokens + m.cacheReadTokens;

  const sorted = [...byModel].sort((a, b) => modelTotal(b) - modelTotal(a));
  const max = byModel.reduce((mx, m) => Math.max(mx, modelTotal(m)), 1) || 1;
  const grand = byModel.reduce((s, m) => s + modelTotal(m), 0) || 1;

  // Aggregate by provider for "Top providers" column
  const provMap = new Map<string, { name: string; tokens: number; calls: number }>();
  for (const m of byModel) {
    const p = m.provider || "direct";
    const cur = provMap.get(p) || { name: p, tokens: 0, calls: 0 };
    cur.tokens += m.tokens;
    cur.calls += m.calls;
    provMap.set(p, cur);
  }
  const providers = Array.from(provMap.values()).sort((a, b) => b.tokens - a.tokens);
  const provMax = Math.max(...providers.map((p) => p.tokens), 1);

  return (
    <Panel className="p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <Eyebrow>Total calls</Eyebrow>
          <div className="num font-semibold text-[26px] tracking-[-0.02em] text-[var(--text)] leading-none mt-2">
            {omni.totalCalls != null ? omni.totalCalls.toLocaleString("en-US") : "—"}
          </div>
        </div>
        <div>
          <Eyebrow>Total tokens</Eyebrow>
          <div className="num font-semibold text-[26px] tracking-[-0.02em] text-[var(--text)] leading-none mt-2">
            {omni.totalTokens != null ? fmtTokens(omni.totalTokens) : "—"}
          </div>
        </div>
        <div>
          <Eyebrow>Synced</Eyebrow>
          <div className="num text-[13px] text-[var(--text-2)] mt-2.5">
            {timeAgo(omni.syncedAt ?? null)}
          </div>
        </div>
      </div>

      {/* Top providers */}
      {providers.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--line)]">
          <Eyebrow>Top providers</Eyebrow>
          <div className="mt-2.5 flex flex-col gap-2">
            {providers.map((p) => (
              <div key={p.name} className="flex items-center gap-3 min-w-0">
                <span className="text-[12px] text-[var(--text-2)] w-28 shrink-0 truncate">{p.name}</span>
                <div className="flex-1 h-[6px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(2, (p.tokens / provMax) * 100)}%`, background: OMNI_C.accent, opacity: 0.85 }}
                  />
                </div>
                <span className="num text-[11px] text-[var(--text-3)] w-14 text-right shrink-0">{fmtTokens(p.tokens)}</span>
                <span className="num text-[10px] text-[var(--hq-text-ghost)] w-9 text-right shrink-0" title={`${p.calls} calls`}>
                  {p.calls}c
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* in / cached / out aggregate bar (cyan palette) */}
      {(() => {
        const cacheTotal = omni.cacheReadTokens ?? 0;
        const input = omni.inputTokens ?? 0;
        const output = omni.outputTokens ?? 0;
        const sum = input + output + cacheTotal;
        if (sum === 0) return null;
        const seg = (v: number) => `${(v / sum) * 100}%`;
        return (
          <div className="mt-4">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
              {cacheTotal > 0 && <div style={{ width: seg(cacheTotal), background: OMNI_C.cache, opacity: 0.8 }} />}
              <div style={{ width: seg(input), background: OMNI_C.input }} />
              <div style={{ width: seg(output), background: OMNI_C.output }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] num text-[var(--hq-text-ghost)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: OMNI_C.input }} />
                in {fmtTokens(input)}
              </span>
              <span className="flex items-center gap-1.5">
                {cacheTotal > 0 && (
                  <>
                    cached {fmtTokens(cacheTotal)}
                    <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: OMNI_C.cache }} />
                  </>
                )}
              </span>
              <span className="flex items-center gap-1.5">
                out {fmtTokens(output)}
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: OMNI_C.output }} />
              </span>
            </div>
          </div>
        );
      })()}

      {/* By model — same √ scale as Hermes */}
      {byModel.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Eyebrow>By model</Eyebrow>
            <span className="num text-[10px] text-[var(--text-3)] inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: OMNI_C.input }} />
                in
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: OMNI_C.output }} />
                out
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: OMNI_C.cache }} />
                cached
              </span>
              <span className="opacity-60">· √ scale</span>
            </span>
          </div>
          {sorted.map((m) => {
            const cacheRead = m.cacheReadTokens ?? 0;
            const total = modelTotal(m);
            const split = total > 0;
            const widthPct = Math.max(2, Math.round(Math.sqrt(total / max) * 100));
            const sharePct = Math.round((total / grand) * 100);
            const knownSum = split ? m.inputTokens + m.outputTokens + cacheRead : 0;
            const segOf = (v: number) => (knownSum > 0 ? (v / knownSum) * 100 : 0);

            return (
              <div key={`${m.provider}/${m.model}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[12px] text-[var(--text-2)] w-32 min-w-0 truncate sm:w-44">
                  {m.model}
                  {m.provider && <span className="text-[10px] text-[var(--text-3)]"> | {m.provider}</span>}
                </span>
                <div className="flex-1 h-[6px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="flex h-full rounded-full overflow-hidden transition-all duration-700 ease-out"
                    style={{ width: `${widthPct}%` }}
                  >
                    {split ? (
                      <>
                        {cacheRead > 0 && (
                          <div
                            className="h-full"
                            style={{ width: `${segOf(cacheRead)}%`, background: OMNI_C.cache, opacity: 0.8 }}
                            title={`cached: ${fmtTokens(cacheRead)}`}
                          />
                        )}
                        <div className="h-full" style={{ width: `${segOf(m.inputTokens)}%`, background: OMNI_C.input, opacity: 0.9 }} />
                        <div className="h-full" style={{ width: `${segOf(m.outputTokens)}%`, background: OMNI_C.output, opacity: 0.85 }} />
                      </>
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: "color-mix(in srgb, var(--text-2) 50%, transparent)" }}
                      />
                    )}
                  </div>
                </div>
                <span className="num text-[11px] text-[var(--text-3)] w-full sm:w-48 sm:shrink-0 sm:text-right tabular-nums whitespace-nowrap">
                  {split ? (
                    <>
                      <span style={{ color: OMNI_C.input }}>in</span> {fmtTokens(m.inputTokens)}
                      {cacheRead > knownSum * 0.01 && (
                        <>{" "}<span style={{ color: OMNI_C.cache }}>·c</span> {fmtTokens(cacheRead)}</>
                      )}
                      {" "}
                      <span style={{ color: OMNI_C.output }}>out</span> {fmtTokens(m.outputTokens)}
                    </>
                  ) : "0"}
                  <span className="text-[var(--text-2)] ml-2">{sharePct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── Run row ───────────────────────────────────────────────
function RunRow({ run, reduce }: { run: Req; reduce: boolean }) {
  const [open, setOpen] = useState(false);
  const tone = STATUS_TONE[run.status];
  const body = run.error || run.result;
  const canExpand = !!body;
  const dur = duration(run.startedAt, run.finishedAt);

  return (
    <div className="px-3.5 py-3">
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 text-left ${
          canExpand ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={canExpand ? open : undefined}
      >
        <StatusDot status={run.status} reduce={reduce} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-[var(--text)] leading-snug truncate">
            {run.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[var(--text-3)] truncate">{run.kind}</span>
            <Pill tone={tone} className="!py-0.5 !text-[10px]">
              {STATUS_LABEL[run.status]}
            </Pill>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-4 text-right">
          <div>
            <div className="num text-[12px] text-[var(--text-2)]">{dur}</div>
            <div className="num text-[10.5px] text-[var(--text-3)] mt-0.5">
              {timeAgo(run.finishedAt || run.startedAt || run.createdAt)}
            </div>
          </div>
          {canExpand && (
            <ChevronRight
              className="w-3.5 h-3.5 text-[var(--text-3)] transition-transform"
              style={{ transform: open ? "rotate(90deg)" : "none" }}
            />
          )}
        </div>
      </button>
      {open && body && (
        <p
          className="mt-3 ml-[18px] text-[12.5px] leading-snug whitespace-pre-wrap rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] p-3"
          style={{ color: run.error ? "var(--down)" : "var(--text-2)" }}
        >
          {body}
        </p>
      )}
    </div>
  );
}

// ── Run history ───────────────────────────────────────────
type Filter = "all" | "running" | "done" | "failed";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "running" },
  { key: "done", label: "done" },
  { key: "failed", label: "failed" },
];

function RunHistory({
  runs,
  loaded,
  reduce,
}: {
  runs: Req[];
  loaded: boolean;
  reduce: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? runs : runs.filter((r) => r.status === filter);

  const count = (f: Filter) =>
    f === "all" ? runs.length : runs.filter((r) => r.status === f).length;

  return (
    <>
      <SectionHeader
        label="Run history"
        title="Recent runs"
        action={
          <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] p-0.5">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--surface-2)] text-[var(--text)]"
                      : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                  }`}
                >
                  {f.label}
                  <span className="num text-[var(--text-3)] ml-1">{count(f.key)}</span>
                </button>
              );
            })}
          </div>
        }
      />
      {!loaded ? (
        <Panel className="p-2">
          <div className="sk h-40 m-1 rounded-[10px]" />
        </Panel>
      ) : shown.length === 0 ? (
        <Panel className="p-2">
          <EmptyState
            icon={<Activity className="w-6 h-6" />}
            title={filter === "all" ? "No runs yet" : `No ${filter} runs`}
            hint="Runs dispatched to Hermes will show up here with duration and results."
          />
        </Panel>
      ) : (
        <Panel className="p-2">
          <div className="divide-y divide-[var(--line)]">
            {shown.map((r) => (
              <RunRow key={r.id} run={r} reduce={reduce} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────
export function HermesRuns() {
  const [runs, setRuns] = useState<Req[]>([]);
  const [cost, setCost] = useState<Cost | null>(null);
  const [omniCost, setOmniCost] = useState<OmniCost | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reduce = usePrefersReducedMotion();
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const [reqs, c, oc] = await Promise.all([
      getJSON<{ requests: Req[]; pending: number }>("/api/hermes/requests?take=60"),
      getJSON<Cost>("/api/hermes/cost"),
      getJSON<OmniCost>("/api/omniroute/cost"),
    ]);
    if (!mounted.current) return;
    if (reqs) setRuns(reqs.requests ?? []);
    if (c) setCost(c);
    if (oc) setOmniCost(oc);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const iv = setInterval(load, 8000);
    return () => {
      mounted.current = false;
      clearInterval(iv);
    };
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Observability</Eyebrow>
        <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] leading-none text-[var(--text)]">
          Runs &amp; usage
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-3 h-3 text-[#a78bfa]" />
            <span className="eyebrow !text-[10px]">Hermes Agent Compute</span>
          </div>
          <UsageStrip cost={cost} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Waypoints className="w-3 h-3" style={{ color: OMNI_C.accent }} />
            <span className="eyebrow !text-[10px]">OmniRoute Edge Compute</span>
          </div>
          <OmniUsageStrip omni={omniCost} />
        </div>
      </div>

      <div>
        <RunHistory runs={runs} loaded={loaded} reduce={reduce} />
      </div>
    </div>
  );
}
