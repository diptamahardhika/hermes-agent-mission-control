// ── Proposal Card ────────────────────────────────────────
"use client";

import { useState, useRef, useLayoutEffect } from "react";

interface Proposal {
  id: string;
  taskId: string;
  agent: string;
  title: string;
  body: string;
  createdAt: string;
  reviewedAt: string | null;
  status: string;
  taskTitle?: string;
  taskStatus?: string;
  followUpTaskId?: string | null;
  followUpStatus?: string | null;   // live kanban status of the created task
  followUpResult?: string | null;
}

// Follow-up task live state → badge text/color
function followUpBadge(p: Proposal): { label: string; color: string } | null {
  if (p.status !== "turned-into-task" || !p.followUpTaskId) return null;
  switch (p.followUpStatus) {
    case "running":
      return { label: "▶ Agent working on it", color: "var(--accent)" };
    case "ready":
    case "todo":
      return { label: "⏳ Queued", color: "var(--warn)" };
    case "review":
      return { label: "👁 In review", color: "var(--warn)" };
    case "blocked":
      return { label: "⚠ Blocked", color: "var(--down)" };
    case "done":
      return { label: "✅ Completed", color: "var(--up)" };
    default:
      return null; // task not created yet / id not linked yet
  }
}

function ProposalCard({
  proposal,
  onReject,
  onCreateTask,
}: {
  proposal: Proposal;
  onReject: (id: string) => void;
  onCreateTask: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Detect actual clamping instead of guessing by character count: a body that
  // fits in 4 lines (or wraps to exactly ≤4) gets no "Read more…" button.
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [proposal.body]);
  const agentEmoji: Record<string, string> = {
    nova: "\u2B50",
    sage: "\uD83C\uDF3F",
    knox: "\uD83D\uDD10",
    max: "\uD83D\uDC3A",
    pixel: "\uD83C\uDFA8",
  };
  const agentColor: Record<string, string> = {
    nova: "var(--purple-500)",
    sage: "var(--sky-500)",
    knox: "var(--emerald-500)",
    max: "var(--amber-500)",
    pixel: "var(--blue-500)",
  };

  const stampColor = proposal.status === "approved"
    ? "var(--up)"
    : proposal.status === "rejected"
    ? "var(--down)"
    : proposal.status === "turned-into-task"
    ? "var(--accent)"
    : "var(--text-4)";

  const liveBadge = followUpBadge(proposal);

  const accent = agentColor[proposal.agent] || "var(--line)";

  return (
    <div className="panel relative flex gap-4 p-4 pl-5 items-start overflow-hidden">
      {/* Agent accent strip — absolute so the panel's rounded border can't clip it */}
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
      {/* Agent badge */}
      <div className="shrink-0 mt-0.5">
        <div className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center text-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          {agentEmoji[proposal.agent] || "\u2022"}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-[var(--text)] truncate">{proposal.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full num border" style={{ color: stampColor, borderColor: `${stampColor}40`, background: `${stampColor}0c` }}>
            {proposal.status === "pending" ? "Pending your call"
              : proposal.status === "approved" ? "Approved"
              : proposal.status === "rejected" ? "Dismissed"
              : "Task created"}
          </span>
          {liveBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full num border animate-pulse" style={{ color: liveBadge.color, borderColor: `${liveBadge.color}40`, background: `${liveBadge.color}0c` }}>
              {liveBadge.label}
            </span>
          )}
        </div>

        <p ref={bodyRef} className={`text-[12px] text-[var(--text-2)] leading-relaxed whitespace-pre-line ${expanded ? "" : "line-clamp-4"}`}>{proposal.body}</p>
        {overflows && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="self-start text-[11px] font-medium transition-colors"
            style={{ color: "var(--accent)" }}
          >
            {expanded ? "Show less" : "Read more…"}
          </button>
        )}

        {liveBadge?.label === "✅ Completed" && proposal.followUpResult && (
          <p className="text-[11px] leading-relaxed rounded-[var(--r-sm)] px-2.5 py-1.5" style={{ background: "color-mix(in srgb, var(--up) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--up) 20%, transparent)", color: "var(--text-2)" }}>
            <span style={{ color: "var(--up)" }}>Result:</span> {proposal.followUpResult.slice(0, 200)}
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-[var(--text-4)]">{new Date(proposal.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          {proposal.taskTitle && <span className="text-[10px] text-[var(--text-4)]">From task: {proposal.taskTitle}</span>}
          {proposal.reviewedAt && <span className="text-[10px] text-[var(--text-4)]">Reviewed {new Date(proposal.reviewedAt).toLocaleDateString()}</span>}
        </div>

        {/* Action buttons */}
        {proposal.status === "pending" && (
          <div className="flex gap-2 mt-1">
            <button onClick={() => onCreateTask(proposal.taskId)} className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: "color-mix(in srgb, var(--up) 12%, transparent)", color: "var(--up)", border: "1px solid color-mix(in srgb, var(--up) 30%, transparent)" }}>
              ✓ Implement — create task for {proposal.agent}
            </button>
            <button onClick={() => onReject(proposal.taskId)} className="text-[11px] px-2.5 py-1 rounded-full" style={{ color: "var(--down)", border: "1px solid color-mix(in srgb, var(--down) 30%, transparent)" }}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { ProposalCard };
