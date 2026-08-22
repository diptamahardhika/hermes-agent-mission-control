"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Fragment,
} from "react";
import {
  BookOpen,
  Search,
  Plus,
  X,
  Pencil,
  Check,
  ChevronDown,
  Link2,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";
import {
  Panel,
  Button,
  Pill,
  EmptyState,
  Skeleton,
  Eyebrow,
} from "@/components/ui/kit";

// ── Types ─────────────────────────────────────────────────
type MemType =
  | "fact"
  | "preference"
  | "decision"
  | "event"
  | "project"
  | "contact"
  | "lesson"
  | "metric"
  | "note";
type MemStatus = "active" | "superseded" | "archived";

interface Entry {
  id: string;
  path: string;
  type: string; // free-form: the bridge mirrors whatever the wiki files declare
  title: string;
  status: MemStatus;
  confidence: number | string | null;
  provenance: string | null;
  tags: string[];
  links: string[];
  body: string;
  validFrom: string | null;
  validTo: string | null;
  updatedAt: string;
  syncedAt: string;
}

interface MemoryResponse {
  entries: Entry[];
  typeCounts: Record<string, number>;
  total: number;
  lastSync: string | null;
}

const TYPES: MemType[] = [
  "fact",
  "preference",
  "decision",
  "event",
  "project",
  "contact",
  "lesson",
  "metric",
  "note",
];

type Tone = "neutral" | "up" | "down" | "warn" | "accent";
function typeTone(t: string): Tone {
  if (t === "decision" || t === "snapshot") return "accent";
  if (t === "lesson") return "warn";
  if (t === "project" || t === "person") return "up";
  return "neutral";
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
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  return `${mo}mo ago`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

// ── Confidence dot ────────────────────────────────────────
// Wiki spec allows word scale (high | medium | low); mirror may also carry
// numbers on 0–1 or 0–100 scales. Normalize all three.
function confidenceValue(c: number | string): number {
  if (typeof c === "string") {
    const w = c.trim().toLowerCase();
    if (w === "high") return 0.9;
    if (w === "medium") return 0.6;
    if (w === "low") return 0.3;
    const n = Number(w);
    return Number.isFinite(n) ? n : 0;
  }
  return c > 1 ? c / 100 : c;
}

function confidenceMeta(c: number | string): { label: string; color: string } {
  const v = confidenceValue(c);
  if (v >= 0.75) return { label: "high confidence", color: "var(--up)" };
  if (v >= 0.4) return { label: "medium confidence", color: "var(--warn)" };
  return { label: "low confidence", color: "var(--down)" };
}

function ConfidenceDot({ value }: { value: number }) {
  const { label, color } = confidenceMeta(value);
  return (
    <span
      className="inline-flex items-center gap-1.5 num text-[10.5px] text-[var(--text-3)]"
      title={label}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

// ── Tiny, safe markdown renderer (builds React elements) ──
// Handles: # / ## headings, - / * bullets, - [ ] / - [x] checkboxes,
// blank-line spacing, paragraphs, and inline `code`.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length > 1) {
      return (
        <code
          key={`${keyBase}-c${i}`}
          className="num text-[12.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)]"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>;
  });
}

function Markdown({ body }: { body: string }) {
  const lines = (body || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: { text: string; check: boolean | null }[] = [];
  let key = 0;

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="my-1.5 space-y-1">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[var(--text-2)]"
          >
            {it.check === null ? (
              <span className="mt-[9px] w-1 h-1 rounded-full bg-[var(--text-3)] shrink-0" />
            ) : (
              <span
                className="mt-[2px] w-3.5 h-3.5 rounded-[4px] border shrink-0 flex items-center justify-center"
                style={{
                  borderColor: it.check ? "var(--up)" : "var(--line-strong)",
                  background: it.check
                    ? "color-mix(in srgb, var(--up) 16%, transparent)"
                    : "transparent",
                }}
              >
                {it.check && (
                  <Check className="w-2.5 h-2.5" style={{ color: "var(--up)" }} />
                )}
              </span>
            )}
            <span className={it.check ? "opacity-70" : ""}>
              {renderInline(it.text, `li-${key}-${i}`)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const checkM = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bulletM = line.match(/^\s*[-*]\s+(.*)$/);

    if (checkM) {
      bullets.push({ text: checkM[2], check: checkM[1].toLowerCase() === "x" });
      continue;
    }
    if (bulletM) {
      bullets.push({ text: bulletM[1], check: null });
      continue;
    }
    flushBullets();

    if (line.startsWith("## ")) {
      blocks.push(
        <h4
          key={`h-${key++}`}
          className="mt-3 mb-1 text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]"
        >
          {renderInline(line.slice(3), `h2-${key}`)}
        </h4>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h3
          key={`h-${key++}`}
          className="mt-3 mb-1 text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]"
        >
          {renderInline(line.slice(2), `h1-${key}`)}
        </h3>
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={`sp-${key++}`} className="h-2" />);
    } else {
      blocks.push(
        <p
          key={`p-${key++}`}
          className="text-[13.5px] leading-relaxed text-[var(--text-2)]"
        >
          {renderInline(line, `p-${key}`)}
        </p>
      );
    }
  }
  flushBullets();

  if (!blocks.length) {
    return (
      <p className="text-[13px] text-[var(--text-3)] italic">No content.</p>
    );
  }
  return <div className="space-y-0.5">{blocks}</div>;
}

// ── Entry card ────────────────────────────────────────────
function EntryCard({
  entry,
  expanded,
  onToggle,
  onEdit,
}: {
  entry: Entry;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <Panel className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-5 py-4 flex items-start gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Pill tone={typeTone(entry.type)}>{entry.type}</Pill>
            {entry.status !== "active" && (
              <Pill tone="neutral">{entry.status}</Pill>
            )}
            {entry.confidence != null && (
              <ConfidenceDot value={Number(entry.confidence)} />
            )}
          </div>
          <h3 className="text-[15px] font-medium text-[var(--text)] leading-snug truncate">
            {entry.title}
          </h3>
          {entry.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {entry.tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="num text-[10.5px] text-[var(--text-3)] rounded-full px-2 py-0.5 bg-[var(--surface-2)] border border-[var(--line)]"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="num text-[10.5px] text-[var(--text-3)]">
            {timeAgo(entry.updatedAt)}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-3)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1">
          <div className="rule mb-4" />
          <Markdown body={entry.body} />

          {/* Metadata */}
          <div className="mt-5 flex flex-col gap-2.5">
            {entry.provenance && (
              <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  source{" "}
                  <span className="text-[var(--text-2)]">{entry.provenance}</span>
                </span>
              </div>
            )}
            {(entry.validFrom || entry.validTo) && (
              <div className="flex items-center gap-2 num text-[11.5px] text-[var(--text-3)]">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  valid {fmtDate(entry.validFrom)}
                  {" → "}
                  {entry.validTo ? fmtDate(entry.validTo) : "present"}
                </span>
              </div>
            )}
            {entry.links.length > 0 && (
              <div className="flex items-start gap-2 text-[11.5px] text-[var(--text-3)]">
                <Link2 className="w-3.5 h-3.5 shrink-0 mt-1" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {entry.links.map((l) => (
                    <span
                      key={l}
                      className="num text-[10.5px] text-[var(--text-2)] rounded-full px-2 py-0.5 bg-[var(--surface-2)] border border-[var(--line)]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 num text-[11px] text-[var(--text-4)]">
              <span>{entry.path}</span>
            </div>
          </div>

          <div className="mt-5">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Edit / New slide-over ─────────────────────────────────
interface Draft {
  id?: string;
  path?: string;
  title: string;
  type: MemType;
  tags: string;
  status: MemStatus;
  confidence: string;
  body: string;
}

function emptyDraft(): Draft {
  return {
    title: "",
    type: "note",
    tags: "",
    status: "active",
    confidence: "",
    body: "",
  };
}

function draftFrom(e: Entry): Draft {
  return {
    id: e.id,
    path: e.path,
    title: e.title,
    type: e.type as MemType,
    tags: e.tags.join(", "),
    status: e.status,
    confidence: e.confidence != null ? String(e.confidence) : "",
    body: e.body,
  };
}

function EntryEditor({
  draft,
  isNew,
  onClose,
  onSaved,
}: {
  draft: Draft;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!d.title.trim() || busy) return;
    setBusy(true);
    const tags = d.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const confNum = d.confidence.trim() ? Number(d.confidence) : null;
    const body: Record<string, unknown> = {
      id: d.id,
      path: d.path,
      type: d.type,
      title: d.title.trim(),
      body: d.body,
      tags,
      status: d.status,
      confidence: Number.isFinite(confNum as number) ? confNum : null,
    };
    try {
      const r = await fetch("/api/hermes/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => {
          onSaved();
        }, 2000);
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] px-3.5 py-2.5 rounded-[10px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] transition-colors";
  const labelCls =
    "block eyebrow !mb-2";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        style={{ backdropFilter: "blur(2px)" }}
      />
      <div className="elevated relative w-full max-w-md h-full overflow-y-auto p-6 animate-[hq-rise_0.3s_ease]">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <Eyebrow>{isNew ? "New memory" : "Edit memory"}</Eyebrow>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              {isNew ? "Add entry" : "Correct entry"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-ghost inline-flex items-center justify-center w-9 h-9 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div
              className="mb-4 w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, var(--up) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--up) 30%, transparent)",
              }}
            >
              <Check className="w-6 h-6" style={{ color: "var(--up)" }} />
            </div>
            <p className="text-[15px] font-medium text-[var(--text)]">
              Saved — Hermes will write it to memory
            </p>
            <p className="mt-1.5 text-[12.5px] text-[var(--text-3)] max-w-xs">
              The bridge is committing this to the wiki. It will reappear here
              once mirrored.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title</label>
              <input
                value={d.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="What should Hermes remember?"
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select
                  value={d.type}
                  onChange={(e) => set("type", e.target.value as MemType)}
                  className={inputCls}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={d.status}
                  onChange={(e) => set("status", e.target.value as MemStatus)}
                  className={inputCls}
                >
                  <option value="active">active</option>
                  <option value="superseded">superseded</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Tags</label>
              <input
                value={d.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="comma, separated, tags"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Confidence (optional)</label>
              <input
                value={d.confidence}
                onChange={(e) => set("confidence", e.target.value)}
                placeholder="0–1 (e.g. 0.9)"
                inputMode="decimal"
                className={`${inputCls} num`}
              />
            </div>

            <div>
              <label className={labelCls}>Body · markdown</label>
              <textarea
                value={d.body}
                onChange={(e) => set("body", e.target.value)}
                rows={10}
                placeholder={"# Heading\n- bullet\n- [ ] task\n\nInline `code` supported."}
                className={`${inputCls} resize-y leading-relaxed`}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                onClick={save}
                disabled={busy || !d.title.trim()}
              >
                <Check className="w-3.5 h-3.5" />
                Save to memory
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function MemoryWikiPage() {
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusAll, setStatusAll] = useState(false);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ draft: Draft; isNew: boolean } | null>(
    null
  );

  // Debounce search input → q
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (typeFilter !== "all") params.set("type", typeFilter);
    params.set("status", statusAll ? "all" : "active");
    const data = await getJSON<MemoryResponse>(
      `/api/hermes/memory?${params.toString()}`
    );
    if (data) {
      setEntries(data.entries ?? []);
      setTypeCounts(data.typeCounts ?? {});
      setTotal(data.total ?? 0);
      setLastSync(data.lastSync ?? null);
    }
    setLoaded(true);
  }, [q, typeFilter, statusAll]);

  // Reload on filter change + poll every 10s
  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const chips = useMemo(() => {
    // Canonical types first (declared order), then any extra types the wiki
    // actually contains — so every pill color has a matching filter chip.
    const known = TYPES.filter((t) => (typeCounts[t] ?? 0) > 0);
    const extra = Object.keys(typeCounts)
      .filter((t) => !TYPES.includes(t as MemType) && (typeCounts[t] ?? 0) > 0)
      .sort();
    return [...known, ...extra].map((t) => ({
      type: t,
      count: typeCounts[t] ?? 0,
    }));
  }, [typeCounts]);

  const openNew = () =>
    setEditor({ draft: emptyDraft(), isNew: true });
  const openEdit = (e: Entry) =>
    setEditor({ draft: draftFrom(e), isNew: false });

  return (
    <>
      <div className="relative z-10 w-full mx-auto pb-16">
        {/* Header */}
        <div className="hq-rise pt-4 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <Eyebrow>Hermes memory</Eyebrow>
            <h1 className="mt-2.5 text-[40px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">
              Memory Wiki
            </h1>
            <p className="mt-3.5 text-[14px] text-[var(--text-2)] leading-relaxed max-w-lg">
              Hermes&apos; long-term brain — everything it remembers, that you
              can browse, search, and correct.
            </p>
            <p className="num text-[11.5px] text-[var(--text-3)] mt-3">
              synced {timeAgo(lastSync)}
            </p>
          </div>
          <div className="shrink-0">
            <Button variant="primary" onClick={openNew}>
              <Plus className="w-3.5 h-3.5" />
              New entry
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="hq-rise flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search memory — titles, bodies, tags…"
                className="w-full bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] pl-10 pr-3.5 py-2.5 rounded-[10px] border border-[var(--line)] focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] outline-none transition-colors"
              />
            </div>
            {/* Status toggle */}
            <div className="flex items-center rounded-full border border-[var(--line)] p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setStatusAll(false)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                  !statusAll
                    ? "bg-[var(--surface-2)] text-[var(--text)]"
                    : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusAll(true)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                  statusAll
                    ? "bg-[var(--surface-2)] text-[var(--text)]"
                    : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                }`}
              >
                All
              </button>
            </div>
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <TypeChip
              label="All"
              count={total}
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
            />
            {chips.map((c) => (
              <TypeChip
                key={c.type}
                label={c.type}
                count={c.count}
                tone={typeTone(c.type)}
                active={typeFilter === c.type}
                onClick={() =>
                  setTypeFilter(typeFilter === c.type ? "all" : c.type)
                }
              />
            ))}
          </div>
        </div>

        {/* List */}
        <div className="mt-8 space-y-3">
          {!loaded ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : entries.length === 0 ? (
            <Panel className="p-2">
              <EmptyState
                icon={<BookOpen className="w-6 h-6" />}
                title={
                  q || typeFilter !== "all"
                    ? "No matching entries"
                    : "No memory synced yet"
                }
                hint={
                  q || typeFilter !== "all"
                    ? "Try a different search or clear the filters."
                    : "Once the Hermes bridge is running with a ~/.hermes/wiki, entries appear here."
                }
                action={
                  q || typeFilter !== "all" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setQInput("");
                        setQ("");
                        setTypeFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </Panel>
          ) : (
            entries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                expanded={expandedId === e.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === e.id ? null : e.id))
                }
                onEdit={() => openEdit(e)}
              />
            ))
          )}
        </div>
      </div>

      {editor && (
        <EntryEditor
          draft={editor.draft}
          isNew={editor.isNew}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      )}
    </>
  );
}

// ── Type filter chip ──────────────────────────────────────
function TypeChip({
  label,
  count,
  tone = "neutral",
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: Tone;
  active: boolean;
  onClick: () => void;
}) {
  const map: Record<Tone, string> = {
    neutral: "var(--text-3)",
    up: "var(--up)",
    down: "var(--down)",
    warn: "var(--warn)",
    accent: "var(--accent)",
  };
  const c = map[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={
        active
          ? {
              color: c,
              background: `color-mix(in srgb, ${c} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
            }
          : {
              color: "var(--text-2)",
              background: "transparent",
              border: "1px solid var(--line)",
            }
      }
    >
      <span className="capitalize">{label}</span>
      <span className="num text-[11px] opacity-70">{count}</span>
    </button>
  );
}
