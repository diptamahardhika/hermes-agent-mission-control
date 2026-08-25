"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import OfficeView from "@/components/OfficeView";
import { ProposalCard } from "./proposal-card";

interface AgentActivity {
  timestamp: string;
  action: string;
  result?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: "idle" | "working" | "error" | "offline";
  currentTask?: string;
  lastActive?: string;
  tasksCompleted: number;
  totalCost: number;
  recentActivity: AgentActivity[];
  proposals?: AgentProposal[];
}

interface AgentProposal {
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
}

const statusConfig: Record<string, { color: string; dot: string; label: string; pulse?: boolean }> = {
  idle: { color: "var(--warn)", dot: "var(--warn)", label: "Idle" },
  working: { color: "var(--accent)", dot: "var(--accent)", label: "Working", pulse: true },
  error: { color: "var(--down)", dot: "var(--down)", label: "Error" },
  offline: { color: "var(--text-3)", dot: "var(--text-4)", label: "Offline" },
  online: { color: "var(--up)", dot: "var(--up)", label: "Online", pulse: true },
  active: { color: "var(--up)", dot: "var(--up)", label: "Active", pulse: true },
  mixed: { color: "var(--warn)", dot: "var(--warn)", label: "Partial" },
};

const roleColors: Record<string, string> = {
  max: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
  sage: "from-sky-500/20 to-sky-600/5 border-sky-500/20",
  knox: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  nova: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
  pixel: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function AgentCard({ agent, isExpanded, onToggle, onChat }: { agent: Agent; isExpanded: boolean; onToggle: () => void; onChat: () => void }) {
  const status = statusConfig[agent.status] || statusConfig.offline;
  const lastActivity = agent.recentActivity.length > 0 ? agent.recentActivity[0] : null;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
  }

  return (
    <div className="panel panel-interactive overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      aria-controls={isExpanded ? `${agent.id}-panel` : undefined}
    >
      {/* Main card */}
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center text-2xl shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            {agent.emoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2 shrink-0">
                {status.pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: status.dot }} />}
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: status.dot }} />
              </span>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">{agent.name}</h3>
              <span className="text-[10px] font-medium" style={{ color: status.color }}>{status.label}</span>
            </div>
            <p className="text-[12px] text-[var(--text-3)] mt-1">{agent.role}</p>

            {/* Collapsed activity preview — always visible */}
            {lastActivity && (
              <p className="text-[12px] mt-2 truncate" style={{ color: "var(--text-3)" }}>
                Last: {lastActivity.action} · {timeAgo(lastActivity.timestamp)}
              </p>
            )}

            {/* Current task */}
            {agent.currentTask && agent.status === "working" && (
              <p className="text-[12px] mt-2 truncate" style={{ color: "var(--accent)" }}>{agent.currentTask}</p>
            )}
          </div>

          {/* Stats */}
          <div className="text-right shrink-0">
            <div className="num text-[22px] font-semibold text-[var(--text)] leading-none">{agent.tasksCompleted}</div>
            <div className="eyebrow mt-1.5">tasks</div>
            {agent.lastActive && (
              <div className="num text-[10px] text-[var(--text-4)] mt-1">{timeAgo(agent.lastActive)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded activity feed */}
      {isExpanded && (
        <div id={`${agent.id}-panel`} className="px-5 py-4 space-y-2.5" style={{ borderTop: "1px solid var(--line)" }}>
          <h4 className="eyebrow">Recent Activity</h4>
          {agent.recentActivity.length === 0 ? (
            <p className="text-[12px] text-[var(--text-3)] py-2">No activity yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {agent.recentActivity.slice(0, 10).map((activity, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[12px]">
                  <span className="num text-[var(--text-4)] shrink-0 w-14">{timeAgo(activity.timestamp)}</span>
                  <span className="text-[var(--text-2)]">{activity.action}</span>
                  {activity.result && (
                    <span className="text-[var(--text-3)] ml-auto truncate max-w-[200px]">{activity.result}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat button — visible on Cards view */}
      {onChat && (
        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--line)" }}>
          <button onClick={onChat} className="flex items-center gap-2 w-full rounded-full py-2 text-[12px] text-[var(--text-2)] transition-colors panel-interactive hover:text-[var(--text)]"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}>
            <span>{agent.emoji}</span> Chat with {agent.name}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Live Agent Chat ───────────────────────────────────────
function AgentChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ role: "user"|"assistant"; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus first focusable on open, restore to trigger on close
  useEffect(() => {
    if (modalRef.current && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, []);

  // Trap focus within modal
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    modal.addEventListener("keydown", trap);
    return () => modal.removeEventListener("keydown", trap);
  }, [msgs, loading]);

  // Escape closes, and restores focus to the chat trigger
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...msgs, { role: "user" as const, content: text }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const r = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, message: text, history: msgs }),
      });
      const d = await r.json() as { reply: string };
      setMsgs([...newMsgs, { role: "assistant", content: d.reply }]);
    } catch {
      setMsgs([...newMsgs, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    }
    setLoading(false);
  }

  const agentColor = roleColors[agent.id]?.split(" ")[0]?.replace("from-","text-")?.replace("/20","") || "text-[var(--text-3)]";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose} onKeyDown={handleKeyDown} aria-modal="true" role="dialog"
      aria-label={`Chat with ${agent.name}`}>
      <div className="elevated w-full max-w-lg overflow-hidden" ref={modalRef} onClick={e => e.stopPropagation()}
        tabIndex={-1}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="text-2xl">{agent.emoji}</div>
          <div>
            <div className="text-[14px] font-semibold text-[var(--text)]">{agent.name}</div>
            <div className="text-[12px] text-[var(--text-3)]">{agent.role}</div>
          </div>
          <button onClick={onClose} ref={firstFocusableRef}
            className="ml-auto text-[var(--text-3)] hover:text-[var(--text)] transition-colors text-xl leading-none"
            aria-label="Close chat">×</button>
        </div>
        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 flex flex-col" style={{ background: "var(--surface-1)" }}>
          {msgs.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[var(--text-3)] text-[13px] text-center">Ask {agent.name} anything.<br/>They&apos;re ready.</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%] rounded-[var(--r-md)] px-3.5 py-2 text-[13px] leading-relaxed"
                style={m.role === "user"
                  ? { background: "var(--surface-3)", color: "var(--text)" }
                  : { background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
                {m.role === "assistant" && <span className="text-xs mr-1">{agent.emoji}</span>}
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-[var(--r-md)] px-3.5 py-2" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <span className="text-[var(--text-3)] text-[13px]">{agent.emoji} thinking…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {/* Input */}
        <div className="flex gap-2 p-3" style={{ borderTop: "1px solid var(--line)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={`Message ${agent.name}…`}
            className="flex-1 rounded-full px-4 py-2 text-[13px] text-[var(--text)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
            aria-label={`Message ${agent.name}`}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 py-2 text-[13px]"
            aria-label="Send message"
          >Send</button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "office">("office");
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [proposalsCollapsed, setProposalsCollapsed] = useState(false);
  const [proposalsLoading, setProposalsLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError("Failed to load agents. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const res = await fetch("/api/agent-proposals");
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : []);
    } catch {}
    setProposalsLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 10000);
    return () => clearInterval(interval);
  }, [loadAgents]);

  useEffect(() => {
    loadProposals();
    const interval = setInterval(loadProposals, 20000);
    return () => clearInterval(interval);
  }, [loadProposals]);

  async function handleReject(taskId: string) {
    await fetch("/api/agent-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", proposalId: taskId }),
    });
    loadProposals();
  }

  async function handleCreateTask(taskId: string) {
    await fetch("/api/agent-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createTask", proposalId: taskId }),
    });
    loadProposals();
  }

  if (loading) {
    return (
      <div className="relative min-h-screen p-8">
        <div className="relative z-10 w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="sk h-32 rounded-[var(--r-lg)]" />)}
        </div>
      </div>
    );
  }

  const maxAgent = agents.find(a => a.id === "max");
  const teamAgents = agents.filter(a => a.id !== "max");
  const online = agents.filter(a => a.status !== "offline").length;
  const working = agents.filter(a => a.status === "working").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);

  return (
    <>
      <div className="relative z-10 w-full mx-auto text-[var(--text)] p-8 pb-16 space-y-8">
      {/* Header */}
      <div className="hq-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2.5">Agent HQ</div>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Your AI Team</h1>
          <p className="text-[13px] text-[var(--text-3)] mt-3">Working 24/7</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 min-w-0">
          {/* Stats */}
          <div className="flex gap-5 sm:gap-7 text-center">
            <div>
              <div className="num text-[22px] font-semibold leading-none" style={{ color: "var(--up)" }}>{online}<span className="text-[var(--text-4)]">/{agents.length}</span></div>
              <div className="eyebrow mt-1.5">Online</div>
            </div>
            <div>
              <div className="num text-[22px] font-semibold leading-none" style={{ color: "var(--accent)" }}>{working}</div>
              <div className="eyebrow mt-1.5">Working</div>
            </div>
            <div>
              <div className="num text-[22px] font-semibold leading-none text-[var(--text)]">{totalTasks}</div>
              <div className="eyebrow mt-1.5">Total Tasks</div>
            </div>
          </div>
          {/* View toggle */}
          <div className="flex rounded-full p-1 gap-1" style={{ border: "1px solid var(--line)" }}>
            <button
              onClick={() => setView("office")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                view === "office"
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Office
            </button>
            <button
              onClick={() => setView("cards")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                view === "cards"
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Live Agent Chat Modal */}
      {chatAgent && <AgentChat agent={chatAgent} onClose={() => setChatAgent(null)} />}

      {/* Proposals section */}
      {proposals.length > 0 && (() => {
        const pendingCount = proposals.filter(p => p.status === "pending").length;
        const doneCount = proposals.length - pendingCount;
        return (
        <div className="panel p-5 space-y-3">
          <button
            className="w-full flex items-center justify-between cursor-pointer"
            onClick={() => setProposalsCollapsed(c => !c)}
          >
            <span className="eyebrow flex items-center gap-2">
              <span className="inline-block transition-transform" style={{ transform: proposalsCollapsed ? "rotate(-90deg)" : "none" }}>▾</span>
              Agent Proposals
            </span>
            <span className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full num border" style={{ color: "var(--warn)", borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)", background: "color-mix(in srgb, var(--warn) 8%, transparent)" }}>
                  {pendingCount} waiting your call
                </span>
              )}
              {doneCount > 0 && (
                <span className="text-[10px] text-[var(--text-4)] num">{doneCount} handled</span>
              )}
            </span>
          </button>
          {!proposalsCollapsed && (
            <>
              <p className="text-[12px] text-[var(--text-3)]">
                Ideas and UI/UX proposals from your agents — review, approve, dismiss, or turn into a task.
              </p>
              {/* Pending first, then handled ones */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {[...proposals].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)).map((p) => (
                  <ProposalCard
                    key={p.taskId}
                    proposal={p}
                    onReject={handleReject}
                    onCreateTask={handleCreateTask}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        );
      })()}

      {/* Empty / failure state */}
      {!loading && agents.length === 0 && (
        <div className="panel p-8 text-center">
          {loadError ? (
            <>
              <div className="text-2xl mb-3">⚠</div>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">Couldn't load agents</h3>
              <p className="text-[12px] text-[var(--text-3)] mt-2 max-w-xs mx-auto">{loadError}</p>
              <button onClick={loadAgents} className="btn-primary mt-5 px-5 py-2 text-[13px]">Retry</button>
            </>
          ) : (
            <>
              <div className="text-2xl mb-3">👤</div>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">No agents yet</h3>
              <p className="text-[12px] text-[var(--text-3)] mt-2">Your AI team will appear here once they're connected.</p>
            </>
          )}
        </div>
      )}

      {/* Office View */}
      {view === "office" && (
        <>
          <OfficeView agents={agents} />
          {/* Chat quick-launch strip */}
          <div className="flex flex-wrap gap-2 pt-2">
            {agents.filter(a => a.id !== "max").map(a => (
              <button key={a.id} onClick={() => setChatAgent(a)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] text-[var(--text-2)] transition-colors panel-interactive"
                style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setChatAgent(a); } }}
                tabIndex={0}
              >
                <span>{a.emoji}</span> Chat with {a.name}
              </button>
            ))}
            {agents.find(a => a.id === "max") && (
              <button onClick={() => setChatAgent(agents.find(a => a.id === "max")!)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] transition-colors"
                style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)" }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setChatAgent(agents.find(a => a.id === "max")!); } }}
                tabIndex={0}
              >
                🐺 Chat with Max
              </button>
            )}
          </div>
        </>
      )}

      {/* Cards View */}
      {view === "cards" && (
        <>
          {/* Chief of Staff (Max) — full width */}
          {maxAgent && (
            <AgentCard
              agent={maxAgent}
              isExpanded={expandedAgent === maxAgent.id}
              onToggle={() => setExpandedAgent(expandedAgent === maxAgent.id ? null : maxAgent.id)}
              onChat={() => setChatAgent(maxAgent)}
            />
          )}

          {/* Team grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isExpanded={expandedAgent === agent.id}
                onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                onChat={() => setChatAgent(agent)}
              />
            ))}
          </div>

          {/* Org chart visual */}
          <div className="pt-6" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="eyebrow mb-5">Team Structure</div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2.5 rounded-[var(--r-md)] px-4 py-2.5"
                style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)" }}>
                <span className="text-xl">🐺</span>
                <div>
                  <div className="text-[13px] font-semibold text-[var(--text)]">Max</div>
                  <div className="text-[10px] text-[var(--text-3)]">Chief of Staff · Orchestrator</div>
                </div>
              </div>
              <div className="w-px h-6" style={{ background: "var(--line-strong)" }} />
              <div className="flex items-center gap-0">
                <div className="w-32 h-px" style={{ background: "var(--line-strong)" }} />
                <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
                <div className="w-32 h-px" style={{ background: "var(--line-strong)" }} />
                <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
                <div className="w-32 h-px" style={{ background: "var(--line-strong)" }} />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {teamAgents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-2.5"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--line)", opacity: agent.status === "offline" ? 0.5 : 1 }}>
                    <span className="text-lg">{agent.emoji}</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--text)]">{agent.name}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{agent.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}
