"use client";

/* ───────────────────────────────────────────────────────────
   Hermy HQ · Agent Proposals (home dashboard widget)
   Compact view of agent proposals needing Dipta's call.
   Reuses ProposalCard from /agents. Pending first; handled
   collapse into a count. Polls /api/agent-proposals every 20s.
   ─────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, ArrowUpRight, SortAsc, SortDesc } from "lucide-react";
import { Panel, Pill, EmptyState, Eyebrow } from "@/components/ui/kit";
import { ProposalCard } from "@/app/agents/proposal-card";

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
  followUpStatus?: string | null;
  followUpResult?: string | null;
}

type SortMode = "newest" | "oldest" | "agent";
type FilterMode = "all" | "pending";

export function AgentProposalsWidget() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>("newest");
  const [filter, setFilter] = useState<FilterMode>("all");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/agent-proposals?sortBy=${sortBy}&filter=${filter}`);
      const data = await r.json();
      setProposals(Array.isArray(data) ? data : []);
    } catch { /* keep last state */ }
    setLoaded(true);
  }, [sortBy, filter]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/agent-proposals?sortBy=${sortBy}&filter=${filter}`);
        const data = await r.json();
        if (!cancelled) setProposals(Array.isArray(data) ? data : []);
      } catch { /* keep last state */ }
      if (!cancelled) setLoaded(true);
    };
    tick();
    const iv = setInterval(tick, 20000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [sortBy, filter]);

  const pending = proposals.filter((p) => p.status === "pending");
  const handled = proposals.length - pending.length;
  const visible = [...proposals].slice(0, 2);

  const reject = async (taskId: string) => {
    await fetch("/api/agent-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", proposalId: taskId }),
    });
    load();
  };

  const createTask = async (taskId: string) => {
    await fetch("/api/agent-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createTask", proposalId: taskId }),
    });
    load();
  };

  const complete = async (taskId: string) => {
    await fetch("/api/agent-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", proposalId: taskId }),
    });
    load();
  };

  const approve = async (taskId: string) => {
    await fetch("/api/agent-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", proposalId: taskId }),
    });
    load();
  };

  const reply = async (taskId: string, agent: string, message: string) => {
    try {
      await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent, message }),
      });
      await fetch("/api/agent-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createTask", proposalId: taskId }),
      });
    } finally {
      load();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <Eyebrow>Agent proposals</Eyebrow>
          <p className="text-[10px] text-[var(--text-4)] mt-0.5">Review agent work</p>
        </div>
        <span className="flex items-center gap-2">
          {pending.length > 0 && <Pill tone="warn">{pending.length} waiting</Pill>}
          {handled > 0 && (
            <span className="num text-[10.5px] text-[var(--text-3)]">{handled} handled</span>
          )}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 mb-3">
        {/* Sort toggle */}
        <div className="flex rounded-full p-0.5 gap-0.5" style={{ border: "1px solid var(--line)" }}>
          <button
            onClick={() => setSortBy("newest")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              sortBy === "newest"
                ? "bg-white/[0.08] text-[var(--text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
            title="Sort by newest first"
          >
            <SortDesc className="w-3 h-3" />
          </button>
          <button
            onClick={() => setSortBy("oldest")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              sortBy === "oldest"
                ? "bg-white/[0.08] text-[var(--text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
            title="Sort by oldest first"
          >
            <SortAsc className="w-3 h-3" />
          </button>
          <button
            onClick={() => setSortBy("agent")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              sortBy === "agent"
                ? "bg-white/[0.08] text-[var(--text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
            title="Sort by title (A-Z)"
          >
            A-Z
          </button>
        </div>

        {/* Filter toggle */}
        <div className="flex rounded-full p-0.5 gap-0.5 ml-auto" style={{ border: "1px solid var(--line)" }}>
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              filter === "all"
                ? "bg-white/[0.08] text-[var(--text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              filter === "pending"
                ? "bg-white/[0.08] text-[var(--text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
          >
            Pending
          </button>
        </div>
      </div>

      {loaded && proposals.length === 0 ? (
        <Panel className="p-2">
          <EmptyState
            icon={<Check className="w-6 h-6" style={{ color: "var(--up)" }} />}
            title="No proposals from your agents."
            hint="When an agent posts an idea or review, it lands here for your call."
          />
        </Panel>
      ) : !loaded ? (
        <Panel className="p-2">
          <EmptyState icon={<Inbox className="w-6 h-6" />} title="Checking…" />
        </Panel>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {visible.map((p) => (
              <ProposalCard key={p.taskId} proposal={p} onReject={reject} onApprove={approve} onCreateTask={createTask} onComplete={complete} onReply={reply} />
            ))}
          </div>
          {proposals.length > visible.length && (
            <p className="mt-2 text-[11px] text-[var(--text-3)]">
              +{proposals.length - visible.length} more on{" "}
              <a href="/agents" className="font-medium" style={{ color: "var(--accent)" }}>Agents →</a>
            </p>
          )}
          <a
            href="/agents"
            className="inline-flex items-center gap-1 self-start mt-3 text-[12.5px] font-medium transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Review all on Agents floor
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </>
      )}
    </div>
  );
}
