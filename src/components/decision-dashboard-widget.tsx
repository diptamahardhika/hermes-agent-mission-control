"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock, X } from "lucide-react";
import { Panel, Eyebrow, Button } from "@/components/ui/kit";

import type { Decision } from "@/types/decision";
import { KIND_BADGE, STATUS_BADGE } from "@/lib/decisions";

interface DecisionDashboardWidgetProps {
  pendingCount: number;
  recentDecisions: Decision[];
  loading: boolean;
  onAction: (action: string, decisionId: string) => void;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const dy = Math.floor(diff / 86400000);
  if (dy > 0) return `${dy}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export function DecisionDashboardWidget({
  pendingCount,
  recentDecisions,
  loading,
  onAction,
}: DecisionDashboardWidgetProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Trigger staggered entrance after mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (loading) {
    return (
      <Panel className="p-6 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full bg-[var(--surface-2)] animate-pulse" />
          <div className="h-4 w-24 bg-[var(--surface-2)] rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--surface-1)] rounded animate-pulse" />
          ))}
        </div>
      </Panel>
    );
  }

  if (recentDecisions.length === 0 && pendingCount === 0) {
    return (
      <Panel className="p-6 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full bg-[var(--up)]" />
          <Eyebrow>Decisions</Eyebrow>
        </div>
        <div className="py-6 text-center">
          <p className="text-[14px] text-[var(--text-2)]">All caught up!</p>
          <p className="mt-1 text-[12px] text-[var(--text-3)]">
            No pending decisions to review.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={`p-6 h-full flex flex-col ${mounted ? "hq-panel-enter" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ background: pendingCount > 0 ? "var(--warn)" : "var(--up)" }}
          />
          <Eyebrow>Decisions</Eyebrow>
        </div>
{pendingCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium num decision-badge"
            style={{
              color: "var(--warn)",
              "--badge-color": "var(--warn)",
            } as React.CSSProperties}
          >
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {recentDecisions.map((decision, i) => {
          const kindInfo = KIND_BADGE[decision.kind] || KIND_BADGE.confirm;
          const statusInfo = STATUS_BADGE[decision.status] || STATUS_BADGE.pending;
          const isExpanded = expandedId === decision.id;

          return (
            <div
              key={decision.id}
              className={`border border-[var(--line)] rounded-lg overflow-hidden decision-item`}
              style={{
                animationDelay: mounted ? `${Math.min(i, 12) * 50}ms` : "0ms",
              }}
            >
              <button
                type="button"
                onClick={() => toggleExpand(decision.id)}
                className="w-full flex items-center gap-2.5 py-2.5 px-3 text-left decision-row transition-[background,border-color,transform] duration-150 ease-out"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: kindInfo.color }}
                />
                <p className="flex-1 text-[13px] leading-snug text-[var(--text)] font-medium truncate">
                  {decision.title}
                </p>
                <span
                  className="text-[10px] font-medium shrink-0 decision-badge"
                  style={{
                    color: kindInfo.color,
                    "--badge-color": kindInfo.color,
                  } as React.CSSProperties}
                >
                  {kindInfo.label}
                </span>
                <span
                  className="shrink-0 text-[10px] text-[var(--accent)]"
                  aria-hidden="true"
                >
                  {isExpanded ? "▼" : "▶"}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-[var(--line)]">
                  <p className="text-[12px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap pt-2">
                    {decision.body.length > 120
                      ? `${decision.body.slice(0, 117)}...`
                      : decision.body}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-4)]">
                      · {timeAgo(decision.createdAt)}
                    </span>
                    {decision.actionTarget?.type && (
                      <span className="text-[10px] text-[var(--text-4)]">
                        → {decision.actionTarget.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {decision.actions.includes("approve") && decision.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => onAction("approve", decision.id)}
                        className="text-[11px] text-[var(--up)] hover:text-[var(--text)] transition-colors duration-150 ease-out decision-btn font-medium"
                      >
                        Approve
                      </button>
                    )}
                    {decision.actions.includes("dismiss") && decision.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => onAction("dismiss", decision.id)}
                        className="text-[11px] text-[var(--text-3)] hover:text-[var(--down)] transition-colors duration-150 ease-out decision-btn"
                      >
                        Dismiss
                      </button>
                    )}
                    {decision.actions.includes("open") && (
                      <button
                        type="button"
                        onClick={() => onAction("open", decision.id)}
                        className="text-[11px] text-[var(--accent)] hover:text-[var(--text)] transition-colors duration-150 ease-out decision-btn"
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAction("view", decision.id)}
                      className="ml-auto text-[11px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors duration-150 ease-out decision-btn"
                    >
                      View all
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recentDecisions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--line)]">
          <a
            href="/admin/decisions"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:text-[var(--text)] transition-colors duration-150 ease-out"
          >
            View all decisions <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </Panel>
  );
}