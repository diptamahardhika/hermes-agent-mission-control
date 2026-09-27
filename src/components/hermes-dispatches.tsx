"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionHeader, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { usePolling } from "@/lib/use-polling";
import { Send } from "lucide-react";

type Req = {
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
  finishedAt: string | null;
};

function ago(d: string | null): string {
  if (!d) return "";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TONE: Record<string, "neutral" | "up" | "down" | "warn" | "accent"> = {
  queued: "neutral",
  awaiting_approval: "warn",
  approved: "accent",
  running: "accent",
  done: "up",
  failed: "down",
  rejected: "neutral",
};
const LABEL: Record<string, string> = {
  queued: "Queued",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  running: "Running",
  done: "Done",
  failed: "Failed",
  rejected: "Rejected",
};

export function HermesDispatches() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hermes/requests?take=15");
      if (r.ok) { const d = await r.json(); setReqs(d.requests ?? []); }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  usePolling(load, 5000);

  return (
    <div>
      <SectionHeader label="Dispatches" title="What you've sent Hermes" />
      {!loaded ? (
        <Panel><div className="sk h-24 m-1 rounded-[10px]" /></Panel>
      ) : reqs.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Send className="w-5 h-5" />}
            title="No dispatches yet"
            hint="Send a task with ⌘K or the bar above — it'll appear here with its live status and result."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2.5">
          {reqs.map((r) => {
            const tone = TONE[r.status] ?? "neutral";
            const running = r.status === "running";
            return (
              <div key={r.id} className="panel p-4">
                <div className="flex items-center gap-3">
                  {running && (
                    <span className="relative flex w-1.5 h-1.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "color-mix(in srgb, var(--accent) 60%, transparent)" }} />
                      <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                    </span>
                  )}
                  <p className="flex-1 min-w-0 text-[14px] text-[var(--text)] truncate">{r.title}</p>
                  <Pill tone={tone}>{LABEL[r.status] ?? r.status}</Pill>
                  <span className="num text-[11px] text-[var(--text-3)] shrink-0 w-16 text-right">{ago(r.createdAt)}</span>
                </div>
                {(r.result || r.error) && (
                  <p className={`mt-2.5 text-[12.5px] leading-snug whitespace-pre-wrap line-clamp-4 ${r.error ? "text-[var(--down)]" : "text-[var(--text-2)]"}`}>
                    {r.error || r.result}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
