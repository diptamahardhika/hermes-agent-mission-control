"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  RefreshCw,
  Check,
  X,
  Pencil,
  Inbox,
  Clock,
  Zap,
  Activity as ActivityIcon,
  LayoutGrid,
  Pause,
  Play,
} from "lucide-react";
import {
  Panel,
  SectionHeader,
  Button,
  Pill,
  EmptyState,
  Skeleton,
  Eyebrow,
} from "@/components/ui/kit";
import { HermesDispatches } from "@/components/hermes-dispatches";
import { HermesRuns } from "@/components/hermes-runs";
import { useToast } from "@/components/ui/toast/toast-context";

// ── Types ─────────────────────────────────────────────────
type ReqStatus =
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
  status: ReqStatus;
  result: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

type EvLevel = "info" | "up" | "warn" | "down";
interface Ev {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  agent: string | null;
  level: EvLevel;
  createdAt: string;
}

interface Task {
  id: string;
  board: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: number | null;
  result: string | null;
  syncedAt: string;
  diagnosticError?: string | null;
}

interface Health {
  online: boolean;
  gateway: string | null;
  detail: string | null;
  lastSeen: string | null;
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

// ── Task board column order ───────────────────────────────
const COLUMN_ORDER = [
  "triage",
  "todo",
  "ready",
  "running",
  "review",
  "blocked",
  "done",
] as const;

function normStatus(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, "");
}
function columnFor(status: string): string {
  const k = normStatus(status);
  for (const c of COLUMN_ORDER) if (k.includes(c)) return c;
  if (k.includes("progress") || k.includes("doing")) return "running";
  if (k.includes("complete")) return "done";
  return "triage";
}
function columnTone(col: string): "neutral" | "up" | "down" | "warn" | "accent" {
  if (col === "done") return "up";
  if (col === "running") return "accent";
  if (col === "blocked") return "down";
  if (col === "review") return "warn";
  return "neutral";
}

function isBlocked(t: Task): boolean {
  return t.status === "blocked";
}

function hasError(t: Task): boolean {
  return !!(t.diagnosticError?.trim());
}

function getError(t: Task): string {
  return t.diagnosticError ?? "";
}
const COLUMN_LABEL: Record<string, string> = {
  triage: "Triage",
  todo: "To do",
  ready: "Ready",
  running: "Running",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
};

function levelColor(l: EvLevel): string {
  if (l === "up") return "var(--up)";
  if (l === "down") return "var(--down)";
  if (l === "warn") return "var(--warn)";
  return "var(--text-3)";
}

// ── Health chip ───────────────────────────────────────────
function HealthChip({ health }: { health: Health | null }) {
  const online = !!health?.online;
  const color = online ? "var(--up)" : "var(--warn)";
  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1.5"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <span className="relative flex w-1.5 h-1.5">
        {online && (
          <span
            className="absolute inline-flex h-full w-full rounded-full animate-ping"
            style={{ background: "color-mix(in srgb, var(--up) 60%, transparent)" }}
          />
        )}
        <span
          className="relative inline-flex w-1.5 h-1.5 rounded-full"
          style={{ background: color }}
        />
      </span>
      <span className="text-[12px] font-semibold">
        {online ? "Online" : "Offline · bridge idle"}
      </span>
      {health?.lastSeen && (
        <span className="num text-[10.5px] text-[var(--text-3)]">
          {timeAgo(health.lastSeen)}
        </span>
      )}
    </div>
  );
}

// ── Dispatch bar ──────────────────────────────────────────
function DispatchBar({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [side, setSide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { success, error, info } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const submit = async () => {
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/hermes/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "oneshot", title, sideEffecting: side }),
      });
      if (r.ok) {
        setText("");
        flash(
          side
            ? "Sent to approval inbox — awaiting your go-ahead."
            : "Queued for Hermes."
        );
        onDone();
      } else {
        flash("Dispatch failed. Try again.");
      }
    } catch {
      flash("Dispatch failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3" suppressHydrationWarning>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
          }}
          placeholder="Ask or tell Hermes to do something…"
          className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] px-3.5 py-2.5 rounded-[10px] border border-[var(--line)] focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] outline-none transition-colors"
          suppressHydrationWarning
        />
        <div className="flex items-center gap-3 shrink-0" suppressHydrationWarning>
          <button
            type="button"
            onClick={() => setSide((s) => !s)}
            aria-pressed={side}
            className="flex items-center gap-2 select-none"
            suppressHydrationWarning
          >
            <span
              className="relative inline-flex h-[18px] w-[32px] rounded-full transition-colors"
              style={{
                background: side
                  ? "color-mix(in srgb, var(--warn) 55%, transparent)"
                  : "var(--surface-2)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="absolute top-[1px] h-[14px] w-[14px] rounded-full bg-[var(--text)] transition-all"
                style={{ left: side ? "15px" : "1px" }}
              />
            </span>
            <span className="text-[12px] font-medium text-[var(--text-2)]">
              side-effecting?
            </span>
          </button>
          <Button variant="primary" onClick={submit} disabled={busy || !text.trim()} suppressHydrationWarning>
            <Send className="w-3.5 h-3.5" />
            Dispatch
          </Button>
        </div>
      </div>
      {toast && (
        <p className="mt-3 text-[12.5px] text-[var(--text-2)] flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" style={{ color: "var(--up)" }} />
          {toast}
        </p>
      )}
    </Panel>
  );
}

// ── Approval inbox card ───────────────────────────────────
function InboxCard({ req, onAction }: { req: Req; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(req.title);
  const [draftPrompt, setDraftPrompt] = useState(req.prompt ?? "");

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch(`/api/hermes/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onAction();
    } catch {
      /* leave card in place on failure */
    } finally {
      setBusy(false);
      setEditing(false);
    }
  };

  return (
    <Panel className={`p-5 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
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
            <p className="mt-1.5 text-[13px] text-[var(--text-2)] leading-snug line-clamp-3">
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
                patch({ action: "edit", title: draftTitle.trim(), prompt: draftPrompt })
              }
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={{
                color: "var(--accent)",
                border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
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

// ── Task board ────────────────────────────────────────────
function TaskBoard({
  tasks,
  total,
  lastSync,
  onRetry,
}: {
  tasks: Task[];
  total: number;
  lastSync: string | null;
  onRetry?: () => void;
}) {
  const [openCols, setOpenCols] = useState<Record<string, boolean>>({});
  const groups: Record<string, Task[]> = {};
  for (const t of tasks) {
    const col = columnFor(t.status);
    (groups[col] ||= []).push(t);
  }
  const cols = COLUMN_ORDER.filter((c) => groups[c]?.length);

  const handleRetry = async (taskId: string) => {
    try {
      await fetch("/api/hermes/tasks/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      onRetry?.();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  return (
    <>
      <SectionHeader
        label="Task board"
        title="Hermes kanban"
        action={
          <div className="flex items-center gap-3">
            <span className="num text-[12px] text-[var(--text-2)]">{total} total</span>
            <span className="num text-[11px] text-[var(--text-3)]">
              synced {timeAgo(lastSync)}
            </span>
          </div>
        }
      />
      {tasks.length === 0 ? (
        <Panel className="p-2">
          <EmptyState
            icon={<LayoutGrid className="w-6 h-6" />}
            title="No tasks on the board"
            hint="Dispatched work and synced kanban cards will show up here."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cols.map((col) => {
            const tone = columnTone(col);
            const MAX_VISIBLE = 7;
            const sorted = [...groups[col]].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
            const expanded = !!openCols[col];
            const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);
            const overflow = expanded ? 0 : sorted.length - visible.length;
            return (
              <div key={col} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                  <Eyebrow>{COLUMN_LABEL[col]}</Eyebrow>
                  <span className="num text-[11px] text-[var(--text-3)]">
                    {groups[col].length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {visible.map((t) => (
                                        <div
                                          key={t.id}
                                          className="panel p-3.5"
                                          style={{
                                            borderLeft: `2px solid color-mix(in srgb, ${
                                              tone === "neutral" ? "var(--text-3)" : `var(--${tone})`
                                            } 55%, transparent)`,
                                          }}
                                        >
                                          <p className="text-[13px] text-[var(--text)] leading-snug line-clamp-2">
                                            {t.title}
                                          </p>
                                          <div className="flex items-center gap-2 mt-2.5">
                                            {t.assignee && (
                                              <span className="num text-[10.5px] text-[var(--text-3)]">
                                                {t.assignee}
                                              </span>
                                            )}
                                            {t.priority != null && t.priority > 0 && (
                                              <span className="num text-[10.5px] text-[var(--text-3)] ml-auto">
                                                P{t.priority}
                                              </span>
                                            )}
                                            {isBlocked(t) && (
                                              <>
                                                {hasError(t) && (
                                                  <span
                                                    className="num text-[10px] text-[var(--text-2)]"
                                                    style={{ color: "var(--down)" }}
                                                    title="blocked"
                                                  >
                                                    ⚠
                                                  </span>
                                                )}
                                                {!hasError(t) && (
                                                  <span
                                                    className="num text-[10px] text-[var(--text-2)]"
                                                    style={{ color: "var(--down)" }}
                                                    title="blocked"
                                                  >
                                                    ⚠
                                                  </span>
                                                )}
                                                {hasError(t) && (
                                                  <span
                                                    className="text-[10px] text-[var(--text-2)] capitalize"
                                                    style={{ fontSize: "0.7rem", marginLeft: "4px" }}
                                                  >
                                                    {getError(t).split("\n")[0]}
                                                  </span>
                                                )}
                                                <button
                                                  onClick={() => handleRetry(t.id)}
                                                  className="self-start text-[10px] text-[var(--accent)] hover:text-[var(--text)] transition-colors px-1 ml-1"
                                                  title="Retry task"
                                                >
                                                  ↻
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                  {overflow > 0 && (
                    <button
                      onClick={() => setOpenCols(prev => ({ ...prev, [col]: !prev[col] }))}
                      className="self-start text-[11px] text-[var(--accent)] hover:text-[var(--text)] transition-colors px-1"
                    >
                      {openCols[col] ? "Show less" : `+${overflow} more…`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Cron / schedules ──────────────────────────────────────
type CronJob = {
  id: string; status: string; name: string; schedule: string;
  nextRun: string | null; lastRun: string | null; lastResult: string | null;
  deliver: string | null; skills: string | null; script: string | null; mode: string | null;
};
function CronPanel({ jobs, syncedAt, onDone }: { jobs: CronJob[]; syncedAt: string | null; onDone: () => void }) {
  const [schedule, setSchedule] = useState("");
  const [prompt, setPrompt] = useState("");
  const [runName, setRunName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/hermes/crons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNote(r.ok ? ok : "Request failed.");
      if (r.ok) onDone();
    } catch {
      setNote("Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (!schedule.trim() || !prompt.trim()) return;
    post(
      { op: "create", schedule: schedule.trim(), prompt: prompt.trim() },
      "Schedule sent to Hermes."
    ).then(() => {
      setSchedule("");
      setPrompt("");
    });
  };
  const runNow = () => {
    if (!runName.trim()) return;
    post({ op: "run", name: runName.trim() }, "Run-now sent to Hermes.").then(() =>
      setRunName("")
    );
  };

  return (
    <>
      <SectionHeader
        label="Cron · schedules"
        title="Recurring jobs"
        action={
          <span className="num text-[11px] text-[var(--text-3)]">
            synced {timeAgo(syncedAt)}
          </span>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Schedules */}
        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Eyebrow>schedules</Eyebrow>
            <span className="num text-[10.5px] text-[var(--text-3)]">
              {jobs.length} job{jobs.length === 1 ? "" : "s"}
            </span>
          </div>
          {jobs.length === 0 ? (
            <p className="text-[13px] text-[var(--text-3)] py-6 text-center">
              No schedules yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[440px] overflow-auto -mx-1 px-1">
              {jobs.map((j) => {
                const active = j.status === "active";
                return (
                  <div key={j.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? "var(--up)" : "var(--text-3)" }} title={j.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--text)] truncate">{j.name || j.id}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 num text-[11px] text-[var(--text-3)]">
                          <span className="text-[var(--text-2)]">{j.schedule}</span>
                          {j.nextRun && <span>next {timeAgo(j.nextRun)}</span>}
                          {j.deliver && <span>→ {j.deliver.split(":")[0]}</span>}
                          {j.skills && <span>{j.skills}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button title="Run now" disabled={busy} onClick={() => post({ op: "run", id: j.id, name: j.name }, "Run-now sent.")} className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-1)] transition-colors">
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                        {active ? (
                          <button title="Pause" disabled={busy} onClick={() => post({ op: "pause", id: j.id, name: j.name }, "Pause sent.")} className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--warn)] hover:bg-[var(--surface-1)] transition-colors">
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button title="Resume" disabled={busy} onClick={() => post({ op: "resume", id: j.id, name: j.name }, "Resume sent.")} className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--up)] hover:bg-[var(--surface-1)] transition-colors">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Controls */}
        <Panel className="p-5">
          <div className="space-y-4">
            <div>
              <Eyebrow className="!mb-2 block">New schedule</Eyebrow>
              <div className="space-y-2.5">
                <input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="Schedule (e.g. 0 9 * * 1)"
                  className="w-full bg-transparent num text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] px-3 py-2 rounded-[8px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  placeholder="Prompt — what should Hermes do on this cadence?"
                  className="w-full bg-transparent text-[13px] text-[var(--text-2)] placeholder:text-[var(--text-3)] px-3 py-2 rounded-[8px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] resize-y"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={create}
                  disabled={busy || !schedule.trim() || !prompt.trim()}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Create schedule
                </Button>
              </div>
            </div>

            <div className="rule" />

            <div>
              <Eyebrow className="!mb-2 block">Run now</Eyebrow>
              <div className="flex items-center gap-2.5">
                <input
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runNow(); } }}
                  placeholder="Job name"
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] px-3 py-2 rounded-[8px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                />
                <Button variant="ghost" size="sm" onClick={runNow} disabled={busy || !runName.trim()}>
                  <Zap className="w-3.5 h-3.5" />
                  Run now
                </Button>
              </div>
            </div>

            {note && (
              <p className="text-[12px] text-[var(--text-2)] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" style={{ color: "var(--up)" }} />
                {note}
              </p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

// ── Activity feed ─────────────────────────────────────────
function ActivityFeed({ events }: { events: Ev[] }) {
  return (
    <>
      <SectionHeader label="Activity" title="Recent events" />
      {events.length === 0 ? (
        <Panel className="p-2">
          <EmptyState
            icon={<ActivityIcon className="w-6 h-6" />}
            title="No recent activity"
            hint="Events from Hermes and its agents will stream in here."
          />
        </Panel>
      ) : (
        <Panel className="p-2">
          <div className="divide-y divide-[var(--line)]">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-3.5 py-3">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: levelColor(e.level) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-[var(--text)] leading-snug truncate">
                      {e.title}
                    </p>
                    <span className="num text-[10.5px] text-[var(--text-3)] shrink-0 ml-auto">
                      {timeAgo(e.createdAt)}
                    </span>
                  </div>
                  {e.detail && (
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-2)] leading-snug line-clamp-2">
                      {e.detail}
                    </p>
                  )}
                  {e.agent && (
                    <span className="num text-[10.5px] text-[var(--text-3)] mt-1 inline-block">
                      {e.agent}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function HermesPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [inbox, setInbox] = useState<Req[]>([]);
  const [pending, setPending] = useState(0);
  const [events, setEvents] = useState<Ev[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskSync, setTaskSync] = useState<string | null>(null);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [cronSync, setCronSync] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { success } = useToast();

  const load = useCallback(async () => {
    const [h, reqs, act, tk, cr] = await Promise.all([
      getJSON<Health>("/api/hermes/health"),
      getJSON<{ requests: Req[]; pending: number }>(
        "/api/hermes/requests?status=awaiting_approval&take=50"
      ),
      getJSON<{ events: Ev[] }>("/api/hermes/activity?take=40"),
      getJSON<{ tasks: Task[]; counts: Record<string, number>; total: number; lastSync: string }>(
        "/api/hermes/tasks"
      ),
      getJSON<{ jobs: CronJob[]; syncedAt: string }>("/api/hermes/crons"),
    ]);
    if (h) setHealth(h);
    if (reqs) {
      setInbox(reqs.requests ?? []);
      setPending(reqs.pending ?? reqs.requests?.length ?? 0);
    }
    if (act) setEvents(act.events ?? []);
    if (tk) {
      setTasks(tk.tasks ?? []);
      setTaskTotal(tk.total ?? tk.tasks?.length ?? 0);
      setTaskSync(tk.lastSync ?? null);

      // Fetch diagnostic info for blocked tasks
      const blockedTasks = (tk.tasks ?? []).filter(t => t.status === "blocked");
      if (blockedTasks.length > 0) {
        try {
          const ids = blockedTasks.map(t => t.id).join(",");
          const diag = await getJSON<Record<string, string>>("/api/hermes/tasks/diagnostics?ids=" + ids);
          if (diag) {
            setTasks(prev => prev.map(t => {
              if (diag[t.id]) return { ...t, diagnosticError: diag[t.id] };
              return t;
            }));
          }
        } catch {
          // ignore diag fetch failures
        }
      }
    }
    if (cr) {
      setJobs(cr.jobs ?? []);
      setCronSync(cr.syncedAt ?? null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  // The page scrolls inside <main class="overflow-auto">, not the window, so
  // native #hash navigation lands at the top. Async-fed sections above #runs
  // also change height after mount, which shifts the target — so keep
  // correcting the scroll until the element's position settles.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    let lastTop = -1;
    let stableTicks = 0;
    let first = true;
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (lastTop >= 0 && Math.abs(top - lastTop) < 2 && stableTicks >= 2) {
        clearInterval(t);
        return;
      }
      if (lastTop >= 0 && Math.abs(top - lastTop) >= 2) stableTicks = 0;
      el.scrollIntoView({ behavior: first ? "smooth" : "auto", block: "start" });
      first = false;
      if (lastTop >= 0 && Math.abs(top - lastTop) < 2) stableTicks++;
      lastTop = top;
    }, 300);
    const stop = setTimeout(() => clearInterval(t), 5000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, []);

  const manualRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <>
      <div className="relative z-10 w-full mx-auto pb-16">
        {/* Header */}
        <div className="hq-rise pt-4 pb-8 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Agent runtime</Eyebrow>
            <h1 className="mt-2.5 text-[40px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">
              Hermes
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <HealthChip health={health} />
            <button
              type="button"
              onClick={manualRefresh}
              aria-label="Refresh"
              className="btn-ghost inline-flex items-center justify-center w-9 h-9"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                success("Test success notification!", 2000);
              }}
              className="btn-ghost inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-[var(--up)] ml-2"
            >
              Test Toast
            </button>
          </div>
        </div>

        {/* Dispatch */}
        <div className="hq-rise">
          <DispatchBar onDone={load} />
        </div>

        {/* Dispatches — what you've sent Hermes + live status/results */}
        <section className="mt-12">
          <HermesDispatches />
        </section>

        {/* Approval inbox */}
        <section className="mt-12">
          <SectionHeader
            label="Approval inbox"
            title="Awaiting approval"
            action={
              pending > 0 ? (
                <Pill tone="warn">{pending} pending</Pill>
              ) : (
                <span className="num text-[11px] text-[var(--text-3)]">clear</span>
              )
            }
          />
          {!loaded ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : inbox.length === 0 ? (
            <Panel className="p-2">
              <EmptyState
                icon={<Inbox className="w-6 h-6" />}
                title="Nothing awaiting approval."
                hint="Side-effecting dispatches land here for a one-tap approve."
              />
            </Panel>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {inbox.map((req) => (
                <InboxCard key={req.id} req={req} onAction={load} />
              ))}
            </div>
          )}
        </section>

        {/* Task board */}
        <section className="mt-12">
          {!loaded ? (
            <>
              <SectionHeader label="Task board" title="Hermes kanban" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            </>
          ) : (
            <TaskBoard tasks={tasks} total={taskTotal} lastSync={taskSync} onRetry={load} />
          )}
        </section>

        {/* Cron / schedules */}
        <section className="mt-12">
          {!loaded ? (
            <>
              <SectionHeader label="Cron · schedules" title="Recurring jobs" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-56" />
                <Skeleton className="h-56" />
              </div>
            </>
          ) : (
            <CronPanel jobs={jobs} syncedAt={cronSync} onDone={load} />
          )}
        </section>

        {/* Activity feed */}
        <section className="mt-12">
          {!loaded ? (
            <>
              <SectionHeader label="Activity" title="Recent events" />
              <Skeleton className="h-64" />
            </>
          ) : (
            <ActivityFeed events={events} />
          )}
        </section>

        {/* Observability — runs & usage */}
        <section id="runs" className="mt-12 scroll-mt-24">
          <HermesRuns />
        </section>
      </div>
    </>
  );
}
