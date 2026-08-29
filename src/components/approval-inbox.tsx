"use client";

/* ───────────────────────────────────────────────────────────
   Hermy HQ · Approval inbox
   "Everything that needs your tap" queue.
   Self-contained: polls /api/hermes/requests, one-tap
   approve / reject / edit via PATCH. Calm Luxury.
   ─────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Check, X, Pencil, Inbox } from "lucide-react";
import {
  Panel,
  Pill,
  EmptyState,
  Eyebrow,
} from "@/components/ui/kit";
import { useToast } from "@/components/ui/toast/toast-context";

// ── Types ─────────────────────────────────────────────────
interface Req {
  id: string;
  origin: string;
  kind: string;
  title: string;
  prompt: string | null;
  sideEffecting: boolean;
  status: string;
  result: string | null;
  error: string | null;
  createdAt: string;
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

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// ── Card ──────────────────────────────────────────────────
function InboxCard({
  req,
  compact,
  onAction,
}: {
  req: Req;
  compact: boolean;
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(req.title);
  const [draftPrompt, setDraftPrompt] = useState(req.prompt ?? "");
  const { success, error } = useToast();

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch(`/api/hermes/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // optimistic: card fades, parent refetches
      onAction();
      success(`Request ${body.action}ed`, 3000);
    } catch {
      setBusy(false);
      setEditing(false);
      error("Failed to update request", 3000);
    }
  };

  const pad = compact ? "p-4" : "p-5";

  return (
    <Panel className={`${pad} ${busy ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill tone="neutral">{req.kind}</Pill>
          {req.sideEffecting && <Pill tone="warn">side-effecting</Pill>}
        </div>
        <span className="num text-[10.5px] text-[var(--text-3)] shrink-0 mt-1">
          {timeAgo(req.createdAt)}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="w-full bg-transparent text-[14px] font-medium text-[var(--text)] px-3 py-2 rounded-[8px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
          />
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            rows={3}
            className="w-full bg-transparent text-[13px] text-[var(--text-2)] px-3 py-2 rounded-[8px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] resize-y"
          />
        </div>
      ) : (
        <>
          <h3 className="text-[15px] font-medium text-[var(--text)] leading-snug">
            {req.title}
          </h3>
          {req.prompt && (
            <p className="mt-1.5 text-[13px] text-[var(--text-2)] leading-snug line-clamp-2">
              {req.prompt}
            </p>
          )}
        </>
      )}

      <div className="flex items-center gap-2 mt-4">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() =>
                patch({
                  action: "edit",
                  title: draftTitle.trim(),
                  prompt: draftPrompt,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={{
                color: "var(--accent)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              }}
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraftTitle(req.title);
                setDraftPrompt(req.prompt ?? "");
              }}
              className="btn-ghost inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => patch({ action: "approve" })}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={{
                color: "var(--up)",
                border: "1px solid color-mix(in srgb, var(--up) 30%, transparent)",
                background: "color-mix(in srgb, var(--up) 10%, transparent)",
              }}
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              type="button"
              onClick={() => patch({ action: "reject" })}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors text-[var(--text-2)] hover:text-[var(--down)]"
              style={{ border: "1px solid var(--line)" }}
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors text-[var(--text-2)] hover:text-[var(--text)]"
              style={{ border: "1px solid var(--line)" }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </>
        )}
      </div>
    </Panel>
  );
}

// ── Main ──────────────────────────────────────────────────
export function ApprovalInbox({ compact = false }: { compact?: boolean }) {
  const [requests, setRequests] = useState<Req[]>([]);
  const [pending, setPending] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await getJSON<{ requests: Req[]; pending: number }>(
      "/api/hermes/requests?status=awaiting_approval&take=50"
    );
    if (data) {
      setRequests(data.requests ?? []);
      setPending(data.pending ?? data.requests?.length ?? 0);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [load]);

  // optimistic removal, then refetch to reconcile
  const handleAction = useCallback(
    (id: string) => {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setPending((p) => Math.max(0, p - 1));
      load();
    },
    [load]
  );

  const count = pending || requests.length;
  const visible = compact ? requests.slice(0, 3) : requests;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <Eyebrow>Approval inbox</Eyebrow>
          <p className="text-[10px] text-[var(--text-4)] mt-0.5">Pre-execute approval</p>
        </div>
        <Pill tone={count > 0 ? "accent" : "neutral"}>
          {count} pending
        </Pill>
      </div>

      {loaded && requests.length === 0 ? (
        <Panel className="p-2">
          <EmptyState
            icon={<Check className="w-6 h-6" style={{ color: "var(--up)" }} />}
            title="Nothing needs you right now — you're clear."
            hint="Side-effecting work waiting on your call will land here."
          />
        </Panel>
      ) : requests.length === 0 ? (
        // pre-load: keep it calm, mirror empty framing
        <Panel className="p-2">
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="Checking the queue…"
          />
        </Panel>
      ) : (
        <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
          {visible.map((req) => (
            <InboxCard
              key={req.id}
              req={req}
              compact={compact}
              onAction={() => handleAction(req.id)}
            />
          ))}
          {compact && count > 3 && (
            <a
              href="/hermes"
              className="inline-flex items-center gap-1 self-start text-[12.5px] font-medium transition-colors"
              style={{ color: "var(--accent)" }}
            >
              View all in Hermes →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
