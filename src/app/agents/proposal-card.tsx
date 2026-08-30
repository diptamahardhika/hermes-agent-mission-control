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
  followUpBlockKind?: string | null; // why a blocked task is blocked (e.g. needs_input)
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
  onApprove,
  onCreateTask,
  onComplete,
  onReply,
  onUnblock,
}: {
  proposal: Proposal;
  onReject: (id: string) => void;
  onApprove?: (id: string) => void;
  onCreateTask: (id: string) => void;
  onComplete: (id: string) => void;
  onReply?: (id: string, agent: string, message: string) => Promise<void>;
  onUnblock?: (taskId: string, message: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);

  async function sendReply() {
    const text = replyText.trim();
    if (!text || replying) return;
    const blocked = proposal.followUpStatus === "blocked" && proposal.followUpBlockKind === "needs_input";
    if (blocked && !onUnblock) return;
    if (!blocked && !onReply) return;
    setReplying(true);
    // Collapse input right away — the send keeps running in the background.
    setReplyText("");
    setShowReply(false);
    setSentNote(blocked
      ? `${proposal.agent} got your answer and is resuming the task.`
      : `${proposal.agent} received your input and is continuing with it.`);
    try {
      if (blocked) {
        await onUnblock!(proposal.followUpTaskId!, text);
      } else {
        await onReply!(proposal.taskId, proposal.agent, text);
      }
    } catch {
      setSentNote("Send failed — try again.");
    } finally {
      setReplying(false);
    }
  }
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
    : proposal.status === "completed"
    ? "var(--purple-500)"
    : "var(--text-4)";

  const liveBadge = followUpBadge(proposal);

  const accent = agentColor[proposal.agent] || "var(--line)";

  return (
    <div className="panel relative flex gap-4 p-4 pl-5 items-start overflow-hidden">
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
          <span className="text-[10px] px-1.5 py-0.5 rounded-full num border flex items-center gap-1" style={{ color: stampColor, borderColor: `color-mix(in srgb, ${stampColor} 40%, transparent)`, background: `color-mix(in srgb, ${stampColor} 10%, transparent)` }}>
            {proposal.status === "pending" ? "Pending your call"
              : proposal.status === "approved" ? "Approved"
              : proposal.status === "rejected" ? "Dismissed"
              : proposal.status === "completed" ? (<>✓ Completed</>)
              : "Task created"}
          </span>
          {liveBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full num border animate-pulse" style={{ color: liveBadge.color, borderColor: `color-mix(in srgb, ${liveBadge.color} 40%, transparent)`, background: `color-mix(in srgb, ${liveBadge.color} 10%, transparent)` }}>
              {liveBadge.label}
            </span>
          )}
        </div>

        {/* Blocked for input — make it actionable instead of a dead end */}
        {proposal.followUpStatus === "blocked" && proposal.followUpBlockKind === "needs_input" && (
          <div className="space-y-2 rounded-[var(--r-sm)] px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--down) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--down) 25%, transparent)" }}>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              <span style={{ color: "var(--down)", fontWeight: 500 }}>⚠ {proposal.agent} paused and needs your input.</span>{" "}
              The task context was incomplete — answer below and they&apos;ll continue with your guidance.
            </p>
            {!showReply && (
              <button onClick={() => setShowReply(true)} className="text-[11px] px-2.5 py-1 rounded-full font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]" style={{ color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" }}>
                💬 Answer {proposal.agent}
              </button>
            )}
            {showReply && (
              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`e.g. "The codebase is ~/hermes-agent-mission-control — implement X in Y"…`}
                  rows={3}
                  disabled={replying}
                  className="w-full text-[12px] leading-relaxed rounded-[var(--r-sm)] px-3 py-2 resize-y"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text)" }}
                  autoFocus
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || replying}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" }}
                >
                  {replying ? "Sending…" : `Send & unblock ${proposal.agent}`}
                </button>
              </div>
            )}
          </div>
        )}

        <p ref={bodyRef} className={`text-[12px] text-[var(--text-2)] leading-relaxed whitespace-pre-line ${expanded ? "" : "line-clamp-4"}`}>{proposal.body}</p>
        {overflows && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="self-start text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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

        {sentNote && (
          <p className="text-[11px] leading-relaxed rounded-[var(--r-sm)] px-2.5 py-1.5" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)" }}>
            📨 {sentNote}
          </p>
        )}

        {/* Action buttons */}
        {proposal.status === "pending" && !replying && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => onCreateTask(proposal.taskId)} className="text-[11px] px-2.5 py-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--up)]" style={{ background: "color-mix(in srgb, var(--up) 12%, transparent)", color: "var(--up)", border: "1px solid color-mix(in srgb, var(--up) 30%, transparent)" }}>
                ✓ Implement — create task for {proposal.agent}
              </button>
              <button onClick={() => onComplete(proposal.taskId)} className="text-[11px] px-2.5 py-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                ✓ Mark as completed
              </button>
              <button onClick={() => setShowReply(s => !s)} className="text-[11px] px-2.5 py-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]" style={{ color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                💬 Reply with guidance
              </button>
              <button onClick={() => onReject(proposal.taskId)} className="text-[11px] px-2.5 py-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--down)]" style={{ color: "var(--down)", border: "1px solid color-mix(in srgb, var(--down) 30%, transparent)" }}>
                Dismiss
              </button>
            </div>
            {showReply && (
              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Answer ${proposal.agent}'s questions or give direction — they'll see this before proceeding…`}
                  rows={3}
                  disabled={replying}
                  className="w-full text-[12px] leading-relaxed rounded-[var(--r-sm)] px-3 py-2 resize-y"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text)" }}
                  autoFocus
                />
                <div className="flex gap-2 items-center">
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || replying}
                    className="text-[11px] px-2.5 py-1 rounded-full font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" }}
                  >
                    {replying ? "Sending…" : `Send to ${proposal.agent}`}
                  </button>
                  <span className="text-[10px] text-[var(--text-4)]">{replying ? `${proposal.agent} is reading your input…` : "They'll continue with your answers."}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { ProposalCard };
