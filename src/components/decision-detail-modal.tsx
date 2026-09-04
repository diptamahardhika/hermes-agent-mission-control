"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, Archive, MapPin, Play, Trash } from "lucide-react";

import type { Decision } from "@/types/decision";
import { KIND_BADGE, STATUS_BADGE } from "@/lib/decisions";

// ── Component ─────────────────────────────────────────────────────────────────
export function DecisionDetailModal({
  decision,
  onClose,
  onAction,
}: {
  decision: Decision;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const kindInfo = KIND_BADGE[decision.kind] || KIND_BADGE.confirm;
  const statusInfo = STATUS_BADGE[decision.status] || STATUS_BADGE.pending;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const bodyExcerpt = decision.body.length > 200
    ? (expanded ? decision.body : `${decision.body.slice(0, 200)}...`)
    : decision.body;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-[var(--bg)] border border-[var(--line)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--line)] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  color: kindInfo.color,
                  background: `color-mix(in srgb, ${kindInfo.color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${kindInfo.color} 24%, transparent)`,
                }}
              >
                {kindInfo.label}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              <span className="text-[10px] text-[var(--text-4)] font-mono ml-auto">
                {decision.id.slice(0, 8)}
              </span>
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--text)] leading-snug">
              {decision.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-1)] transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-medium text-[var(--text-4)] uppercase tracking-wider mb-1.5 block">
                Details
              </label>
              <p className="text-[13px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
                {bodyExcerpt}
              </p>
              {decision.body.length > 200 && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-1.5 text-[11px] text-[var(--accent)] hover:text-[var(--text)] transition-colors"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {decision.actionTarget && (
              <div>
                <label className="text-[10px] font-medium text-[var(--text-4)] uppercase tracking-wider mb-1.5 block">
                  Action Target
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-1)] rounded-lg">
                  <MapPin className="w-4 h-4 text-[var(--text-3)]" />
                  <span className="text-[12px] text-[var(--text-2)]">
                    {decision.actionTarget.type}
                    {decision.actionTarget.id && (
                      <span className="font-mono text-[var(--text-4)] ml-1">
                        #{decision.actionTarget.id}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-[var(--text-4)] uppercase tracking-wider mb-1.5 block">
                  Created
                </label>
                <p className="text-[12px] text-[var(--text-2)]">
                  {new Date(decision.createdAt).toLocaleString()}
                </p>
              </div>
              {decision.decidedAt && (
                <div>
                  <label className="text-[10px] font-medium text-[var(--text-4)] uppercase tracking-wider mb-1.5 block">
                    Decided
                  </label>
                  <p className="text-[12px] text-[var(--text-2)]">
                    {new Date(decision.decidedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="border-t border-[var(--line)] px-5 py-3 flex items-center gap-2 flex-wrap">
          {decision.actions.includes("approve") && decision.status === "pending" && (
            <button
              onClick={() => onAction("approve")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--up)]/10 text-[var(--up)] hover:bg-[var(--up)]/20 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {decision.actions.includes("dismiss") && decision.status === "pending" && (
            <button
              onClick={() => onAction("dismiss")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-3)]/10 text-[var(--text-3)] hover:bg-[var(--text-3)]/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Dismiss
            </button>
          )}
          {decision.actions.includes("open") && (
            <button
              onClick={() => onAction("open")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" /> Open
            </button>
          )}
          {decision.kind === "archive" && decision.actions.includes("approve") && (
            <button
              onClick={() => onAction("archive")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--warn)]/10 text-[var(--warn)] hover:bg-[var(--warn)]/20 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
          {decision.kind === "pin" && decision.actions.includes("approve") && (
            <button
              onClick={() => onAction("pin")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" /> Pin
            </button>
          )}
          {decision.kind === "resolve" && decision.actions.includes("approve") && (
            <button
              onClick={() => onAction("resolve")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--up)]/10 text-[var(--up)] hover:bg-[var(--up)]/20 transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Resolve
            </button>
          )}
          <div className="ml-auto" />
          <button
            onClick={() => onAction("delete")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--down)] hover:bg-[var(--down)]/10 transition-colors"
          >
            <Trash className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}