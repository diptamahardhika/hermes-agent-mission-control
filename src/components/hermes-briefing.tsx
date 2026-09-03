"use client";

/* ───────────────────────────────────────────────────────────
   Hermy HQ · Chief-of-Staff brief
   Renders Hermes' daily brief (GET /api/hermes/briefing), a live
   "needs you" chip, and a Generate-now button (POST → bridge runs it).
   ─────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sunrise, RefreshCw, ArrowUpRight } from "lucide-react";
import { Panel, Eyebrow, Button } from "@/components/ui/kit";
import { FEATURES, getDecisionLayerFromBriefing } from "@/lib/features";

// Decision layer types (Phase 2.1)
type DecisionKind = "archive" | "pin" | "resolve" | "confirm";
type DecisionAction = "approve" | "dismiss" | "open" | "edit";

interface DecisionActionTarget {
  type: "task" | "request" | "path";
  id?: string;
  hash?: string;
}

interface Decision {
  id: string;                    // deterministic slug from content
  title: string;                 // human-readable headline
  body: string;                  // full context (shown expanded)
  kind: DecisionKind;
  actionTarget?: DecisionActionTarget;
  actions: DecisionAction[];
  metadata?: Record<string, unknown>; // extensibility
}

// Union type for backward compatibility
type DecisionItem = string | Decision;

interface Section { label: string; items: DecisionItem[] }
interface Briefing {
  generatedAt: string | null;
  greeting?: string | null;
  summary: string | null;
  sections?: Section[];
  decisionLayer?: "legacy" | "structured";  // feature toggle signal
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), dy = Math.floor(diff / 86400000);
  if (dy > 0) return `${dy}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

// tone a section by its intent
function sectionTone(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("decision") || l.includes("approv")) return "var(--warn)";
  if (l.includes("ship") || l.includes("done") || l.includes("win")) return "var(--up)";
  if (l.includes("next") || l.includes("priorit")) return "var(--accent)";
  return "var(--text-3)";
}

// Render a single decision item (string or Decision)
function DecisionItemRow({
  item,
  itemKey,
  expanded,
  onToggle,
  onAction,
}: {
  item: DecisionItem;
  itemKey: string;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: "approve" | "dismiss" | "open" | "edit", itemId: string) => void;
}) {
  if (typeof item === "string") {
    // Legacy string item - render with truncation
    return (
      <div className="flex flex-col gap-2.5 border-b border-[var(--line)] last:border-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex gap-2.5 py-1.5 items-start w-full text-left hover:bg-[var(--surface-1)] transition-colors -mx-1 px-1 rounded-md"
        >
          <span className="text-[var(--text-4)] shrink-0 pt-0.5 text-[12px]">·</span>
          <p className="flex-1 text-[13px] leading-snug text-[var(--text-2)] font-medium">
            {item.length > 80 ? `${item.slice(0, 77)}...` : item}
          </p>
          <span className="shrink-0 text-[10px] text-[var(--accent)] ml-2">
            {expanded ? '▼' : '▶'}
          </span>
        </button>
        {expanded && (
          <div className="pl-5 pr-2 pb-2 space-y-2 border-l border-[var(--line)] ml-[11px] mt-1">
            <p className="text-[12px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
              {item}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => onAction("open", itemKey)}
                className="text-[11px] text-[var(--accent)] hover:text-[var(--text)] transition-colors"
              >
                Open in Hermes
              </button>
              <button
                type="button"
                onClick={() => onAction("dismiss", itemKey)}
                className="text-[11px] text-[var(--text-3)] hover:text-[var(--down)] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Structured Decision item
  return (
    <div className="flex flex-col gap-2.5 border-b border-[var(--line)] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex gap-2.5 py-1.5 items-start w-full text-left hover:bg-[var(--surface-1)] transition-colors -mx-1 px-1 rounded-md"
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "var(--warn)" }} />
        <p className="flex-1 text-[13px] leading-snug text-[var(--text)] font-semibold">
          {item.title}
        </p>
        <span className="shrink-0 text-[10px] text-[var(--accent)] ml-2">
          {expanded ? '▼' : '▶'}
        </span>
      </button>
      {expanded && (
        <div className="pl-6 pr-2 pb-2 space-y-2">
          <p className="text-[12px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
            {item.body}
          </p>
          {item.kind && (
            <span className="inline-block text-[10px] font-medium text-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] border border-[color-mix(in_srgb,var(--warn)_24%,transparent)] rounded-full px-2 py-0.5">
              {item.kind}
            </span>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.actions.includes("approve") && (
              <button
                type="button"
                onClick={() => onAction("approve", item.id)}
                className="text-[11px] text-[var(--up)] hover:text-[var(--text)] transition-colors font-medium"
              >
                Approve
              </button>
            )}
            {item.actions.includes("dismiss") && (
              <button
                type="button"
                onClick={() => onAction("dismiss", item.id)}
                className="text-[11px] text-[var(--text-3)] hover:text-[var(--down)] transition-colors"
              >
                Dismiss
              </button>
            )}
            {item.actions.includes("open") && (
              <button
                type="button"
                onClick={() => onAction("open", item.id)}
                className="text-[11px] text-[var(--accent)] hover:text-[var(--text)] transition-colors"
              >
                Open
              </button>
            )}
            {item.actionTarget?.type && (
              <span className="text-[10px] text-[var(--text-4)] ml-auto">
                → {item.actionTarget.type}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HermesBriefing() {
  const router = useRouter();
  const [data, setData] = useState<Briefing | null>(null);
  const [pending, setPending] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genFailed, setGenFailed] = useState(false);
  const [genSuccess, setGenSuccess] = useState(false);
  const [decisionLayer, setDecisionLayer] = useState<"legacy" | "structured">("legacy");
  const genAt = useRef<string | null>(null);
  // Map of item key -> expanded state, only one hook for all items
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const expandItem = (key: string, value: boolean) => {
    setExpandedMap(prev => ({ ...prev, [key]: value }));
  };

  const load = useCallback(async () => {
    try {
      const [b, r, g] = await Promise.all([
        fetch("/api/hermes/briefing").then((x) => (x.ok ? x.json() : null)),
        fetch("/api/hermes/requests?status=awaiting_approval&take=1").then((x) => (x.ok ? x.json() : null)),
        // while generating, watch the latest generate request so a failure
        // stops the spinner instead of spinning forever
        generating
          ? fetch("/api/hermes/requests?kind=briefing.generate&take=1").then((x) => (x.ok ? x.json() : null))
          : Promise.resolve(null),
      ]);
      if (b) {
        setData(b);
        // stop the "generating" spinner once a fresh brief lands
        if (generating && b.generatedAt && b.generatedAt !== genAt.current) {
          setGenerating(false);
          setGenSuccess(true);
          setTimeout(() => setGenSuccess(false), 3000);
        }
      }
      if (r) setPending(r.pending ?? 0);
      if (g?.requests?.[0]?.status === "failed") {
        setGenerating(false);
        setGenFailed(true);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, [generating]);

  useEffect(() => {
    load();
    const iv = setInterval(load, generating ? 6000 : 20000);
    return () => clearInterval(iv);
  }, [load, generating]);

  // Update decision layer based on feature flag and briefing data
  useEffect(() => {
    if (data) {
      const layer = getDecisionLayerFromBriefing(data);
      setDecisionLayer(layer);
    }
  }, [data]);

  const generate = async () => {
    genAt.current = data?.generatedAt ?? null;
    setGenerating(true);
    setGenFailed(false);
    try { await fetch("/api/hermes/briefing", { method: "POST" }); } catch { /* ignore */ }
  };

  const empty = !data || !data.generatedAt || !data.summary;

  return (
    <Panel className="p-6 h-full">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <Sunrise className="w-4 h-4 text-[var(--accent)]" />
          <Eyebrow>Chief of Staff</Eyebrow>
          {!empty && (
            <span className="num text-[11px] text-[var(--text-3)]">· {timeAgo(data!.generatedAt as string)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pending > 0 && (
            <a href="/hermes" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium num transition-colors hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--warn)]"
              style={{ color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warn) 24%, transparent)" }}>
              {pending} need{pending === 1 ? "s" : ""} you <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={generate} disabled={generating}>
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      {genSuccess && (
        <div className="mb-3 text-[12px] text-[var(--up)] flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
          Brief updated · {timeAgo(data!.generatedAt as string)}
        </div>
      )}

      {empty ? (
        <div className="py-6 text-center">
          <p className="text-[14px] text-[var(--text-2)]">
            {generating ? "Hermes is writing your brief… (~1 min)" : loaded ? (genFailed ? "Hermes couldn't write a brief that time — try again." : "No brief yet.") : "Loading…"}
          </p>
          {!generating && loaded && !genFailed && (
            <p className="mt-1 text-[12.5px] text-[var(--text-3)]">
              It auto-generates each morning — or hit Generate to get one now.
            </p>
          )}
        </div>
      ) : (
        <>
          {data!.greeting && (
            <p className="text-[15px] font-medium text-[var(--text)] mb-1.5">{data!.greeting}</p>
          )}
          <p className="text-[14px] leading-relaxed text-[var(--text-2)] max-w-[75ch]">{data!.summary}</p>

          {(data!.sections ?? []).length > 0 && (
            <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-6">
              {data!.sections!.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sectionTone(s.label) }} />
                    <Eyebrow className="!text-[9.5px]">{s.label}</Eyebrow>
                  </div>
                  <div>
                    {s.items.map((item, j) => {
                      const key = `${i}-${j}`;
                      const expanded = expandedMap[key] || false;
                      const handleAction = async (action: "approve" | "dismiss" | "open" | "edit", itemId: string) => {
                        const message = typeof item === 'string' ? item : item.title;
                        
                        if (action === "dismiss") {
                          // Show dismiss notification
                          const el = document.createElement('div');
                          el.textContent = `Dismissed: ${message}`;
                          el.className = 'fixed bottom-4 right-4 bg-[var(--up)] text-white px-4 py-2 rounded-lg shadow-lg z-50';
                          document.body.appendChild(el);
                          setTimeout(() => el.remove(), 2000);
                          expandItem(key, false);
                        } else if (action === "open") {
                          router.push('/hermes#inbox');
                        } else if (action === "approve" && typeof item === "object" && item.id) {
                          // Call API for structured decisions
                          try {
                            await fetch(`/api/hermes/decisions/${item.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action, decisionLayer })
                            });
                            const successEl = document.createElement('div');
                            successEl.textContent = `Decision approved: ${message}`;
                            successEl.className = 'fixed bottom-4 right-4 bg-[var(--up)] text-white px-4 py-2 rounded-lg shadow-lg z-50';
                            document.body.appendChild(successEl);
                            setTimeout(() => successEl.remove(), 3000);
                            expandItem(key, false);
                          } catch (err) {
                            console.error("Decision action failed:", err);
                          }
                        }
                      };
                      return (
                        <DecisionItemRow
                          key={key}
                          item={item}
                          itemKey={key}
                          expanded={expanded}
                          onToggle={() => expandItem(key, !expanded)}
                          onAction={handleAction}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
