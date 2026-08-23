"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, Gauge } from "lucide-react";
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
}

interface Cost {
  summary?: string | null;
  byModel?: ModelUsage[];
  totalCost?: number | null;
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  syncedAt?: string | null;
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
  const modelTotal = (m: ModelUsage) =>
    m.inputTokens != null && m.outputTokens != null
      ? m.inputTokens + m.outputTokens
      : m.tokens ?? m.cost ?? m.calls ?? 0;
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

      {cost?.summary && (
        <p className="mt-4 text-[12.5px] text-[var(--text-2)] leading-snug">
          {cost.summary}
        </p>
      )}

      {cost?.inputTokens != null && cost?.outputTokens != null && cost.inputTokens + cost.outputTokens > 0 && (
        <div className="mt-4">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
            <div style={{ width: `${Math.round((cost.inputTokens / (cost.inputTokens + cost.outputTokens)) * 100)}%`, background: "#a78bfa" }} />
            <div style={{ width: `${100 - Math.round((cost.inputTokens / (cost.inputTokens + cost.outputTokens)) * 100)}%`, background: "#38bdf8" }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] num text-[var(--hq-text-ghost)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#a78bfa" }} />
              in {fmtTokens(cost.inputTokens)}
            </span>
            <span className="flex items-center gap-1.5">
              out {fmtTokens(cost.outputTokens)}
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#38bdf8" }} />
            </span>
          </div>
        </div>
      )}

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
                <span className="opacity-60">· √ scale</span>
              </span>
            )}
          </div>
          {sorted.map((m) => {
            const split = m.inputTokens != null && m.outputTokens != null && m.inputTokens + m.outputTokens > 0;
            const total = modelTotal(m) ?? 0;
            const widthPct = Math.max(2, Math.round(Math.sqrt(total / max) * 100));
            const sharePct = Math.round((total / grand) * 100);
            const inPct = split ? Math.round((m.inputTokens! / (m.inputTokens! + m.outputTokens!)) * 100) : 100;
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
              <div key={m.model} className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--text-2)] w-56 shrink-0 truncate">
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
                        <div className="h-full" style={{ width: `${inPct}%`, background: "#a78bfa", opacity: 0.9 }} />
                        <div className="h-full" style={{ width: `${100 - inPct}%`, background: "#38bdf8", opacity: 0.85 }} />
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
                <span className="num text-[11px] text-[var(--text-3)] shrink-0 w-32 text-right tabular-nums whitespace-nowrap">
                  {split ? (
                    <>
                      <span style={{ color: "#a78bfa" }}>in</span> {fmtTokens(m.inputTokens!)}
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
  const [loaded, setLoaded] = useState(false);
  const reduce = usePrefersReducedMotion();
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const [reqs, c] = await Promise.all([
      getJSON<{ requests: Req[]; pending: number }>("/api/hermes/requests?take=60"),
      getJSON<Cost>("/api/hermes/cost"),
    ]);
    if (!mounted.current) return;
    if (reqs) setRuns(reqs.requests ?? []);
    if (c) setCost(c);
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

      <UsageStrip cost={cost} />

      <div>
        <RunHistory runs={runs} loaded={loaded} reduce={reduce} />
      </div>
    </div>
  );
}
