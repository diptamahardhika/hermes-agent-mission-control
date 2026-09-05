"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X, Trash, ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { DecisionDetailModal } from "@/components/decision-detail-modal";
import type { Decision, DecisionKind, DecisionStatus } from "@/types/decision";
import { KIND_BADGE, STATUS_BADGE } from "@/lib/decisions";

interface DecisionFilters {
  status: DecisionStatus | "all";
  kind: DecisionKind | "all";
  search: string;
  dateRange: "all" | "today" | "week" | "month";
}

const PAGE_SIZE = 20;

export default function AdminDecisionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ status: Record<string, number>; kind: Record<string, number> }>({ status: {}, kind: {} });

  const [filters, setFilters] = useState<DecisionFilters>({
    status: "all",
    kind: "all",
    search: "",
    dateRange: "all",
  });

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"createdAt" | "title">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.kind !== "all") params.set("kind", filters.kind);
      params.set("limit", String(PAGE_SIZE * page));

      const res = await fetch(`/api/hermes/decisions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch decisions");
      const data = await res.json();
      setDecisions(data.decisions || []);
      setTotal(data.total || 0);
      setCounts(data.counts || { status: {}, kind: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  // Highlight specific decision
  useEffect(() => {
    if (highlightId) {
      const decision = decisions.find((d) => d.id === highlightId);
      if (decision) {
        setSelectedDecision(decision);
        window.history.replaceState(null, "", "/admin/decisions");
      }
    }
  }, [highlightId, decisions]);

  const handleAction = async (action: string, decisionId: string) => {
    try {
      const res = await fetch(`/api/hermes/decisions/${decisionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      await loadDecisions();
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const handleDelete = async (decisionId: string) => {
    if (!confirm("Are you sure you want to delete this decision?")) return;
    try {
      const res = await fetch(`/api/hermes/decisions/${decisionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await loadDecisions();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleBulkAction = async (action: string) => {
    for (const id of selected) {
      await handleAction(action, id);
    }
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === decisions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(decisions.map((d) => d.id)));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const filteredCount = total;

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen">
      {/* Left Sidebar - Filters */}
      <aside className="w-64 border-r border-[var(--line)] p-4 space-y-6 overflow-y-auto hidden md:block">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </h2>

          {/* Status filter */}
          <div className="mb-4">
            <label className="text-[11px] font-medium text-[var(--text-3)] mb-2 block">Status</label>
            <div className="space-y-1.5">
              {(["all", "pending", "approved", "dismissed", "resolved"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilters((f) => ({ ...f, status: s }))}
                  className={`w-full text-left px-2 py-1.5 rounded text-[12px] transition-colors ${
                    filters.status === s
                      ? "bg-[var(--surface-1)] text-[var(--text)]"
                      : "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_BADGE[s]?.label || s}
                  {s !== "all" && (
                    <span className="ml-auto text-[10px] text-[var(--text-4)]">
                      ({counts.status[s] ?? 0})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Kind filter */}
          <div className="mb-4">
            <label className="text-[11px] font-medium text-[var(--text-3)] mb-2 block">Kind</label>
            <div className="space-y-1.5">
              {(["all", "archive", "pin", "resolve", "confirm"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilters((f) => ({ ...f, kind: k }))}
                  className={`w-full text-left px-2 py-1.5 rounded text-[12px] transition-colors ${
                    filters.kind === k
                      ? "bg-[var(--surface-1)] text-[var(--text)]"
                      : "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]"
                  }`}
                >
                  {k === "all" ? "All Kinds" : KIND_BADGE[k]?.label || k}
                  {k !== "all" && (
                    <span className="ml-auto text-[10px] text-[var(--text-4)]">
                      ({counts.kind[k] ?? 0})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="mb-4">
            <label className="text-[11px] font-medium text-[var(--text-3)] mb-2 block">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value as any }))}
              className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded px-2 py-1.5 text-[12px] text-[var(--text)]"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-3)] mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-4)]" />
              <input
                type="text"
                placeholder="Search title..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full bg-[var(--surface-1)] border border-[var(--line)] rounded pl-8 pr-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-4)]"
              />
            </div>
          </div>
        </div>

        {/* Clear filters */}
        <button
          onClick={() =>
            setFilters({ status: "all", kind: "all", search: "", dateRange: "all" })
          }
          className="w-full text-[11px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors py-1"
        >
          Clear Filters
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--line)] p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[16px] font-semibold text-[var(--text)]">Decisions</h1>
            <span className="text-[12px] text-[var(--text-4)]">
              {filteredCount} total
            </span>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--text-3)]">
                {selected.size} selected
              </span>
              <button
                onClick={() => handleBulkAction("approve")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium bg-[var(--up)]/10 text-[var(--up)] hover:bg-[var(--up)]/20 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => handleBulkAction("dismiss")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium bg-[var(--text-3)]/10 text-[var(--text-3)] hover:bg-[var(--text-3)]/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 text-center">
              <p className="text-[13px] text-[var(--text-3)]">Loading decisions...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-[13px] text-[var(--down)]">{error}</p>
              <button
                onClick={loadDecisions}
                className="mt-2 text-[12px] text-[var(--accent)] hover:text-[var(--text)]"
              >
                Retry
              </button>
            </div>
          ) : decisions.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[13px] text-[var(--text-3)]">No decisions found</p>
              <p className="mt-1 text-[12px] text-[var(--text-4)]">
                {filters.search || filters.status !== "all" || filters.kind !== "all"
                  ? "Try adjusting your filters"
                  : "Decisions will appear here when Hermes creates them"}
              </p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--surface-1)] sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-4 py-2.5 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === decisions.length && decisions.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-[var(--line)] bg-[var(--surface-2)]"
                    />
                  </th>
                  <th
                    className="px-4 py-2.5 text-left cursor-pointer hover:text-[var(--text)]"
                    onClick={() => {
                      if (sortField === "title") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else { setSortField("title"); setSortDir("asc"); }
                    }}
                  >
                    Title {sortField === "title" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-4 py-2.5 text-left">Kind</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th
                    className="px-4 py-2.5 text-left cursor-pointer hover:text-[var(--text)]"
                    onClick={() => {
                      if (sortField === "createdAt") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else { setSortField("createdAt"); setSortDir("asc"); }
                    }}
                  >
                    Created {sortField === "createdAt" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {decisions.map((decision) => {
                  const kindInfo = KIND_BADGE[decision.kind] || KIND_BADGE.confirm;
                  const statusInfo = STATUS_BADGE[decision.status] || STATUS_BADGE.pending;
                  const isSelected = selected.has(decision.id);

                  return (
                    <tr
                      key={decision.id}
                      className={`hover:bg-[var(--surface-1)] transition-colors ${
                        isSelected ? "bg-[var(--surface-1)]" : ""
                      } ${highlightId === decision.id ? "ring-1 ring-[var(--accent)]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(decision.id)}
                          className="w-4 h-4 rounded border-[var(--line)] bg-[var(--surface-2)]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[300px] truncate font-medium text-[var(--text)]">
                          {decision.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-4)] font-mono mt-0.5">
                          {decision.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            color: kindInfo.color,
                            background: `color-mix(in srgb, ${kindInfo.color} 12%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${kindInfo.color} 24%, transparent)`,
                          }}
                        >
                          {kindInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[var(--text-4)]">
                        {new Date(decision.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {decision.status === "pending" && decision.actions.includes("approve") && (
                            <button
                              onClick={() => handleAction("approve", decision.id)}
                              className="p-1.5 rounded hover:bg-[var(--up)]/10 text-[var(--up)] transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {decision.status === "pending" && decision.actions.includes("dismiss") && (
                            <button
                              onClick={() => handleAction("dismiss", decision.id)}
                              className="p-1.5 rounded hover:bg-[var(--text-3)]/10 text-[var(--text-3)] transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedDecision(decision)}
                            className="p-1.5 rounded hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-colors"
                            title="View details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(decision.id)}
                            className="p-1.5 rounded hover:bg-[var(--down)]/10 text-[var(--down)] transition-colors"
                            title="Delete"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-[var(--line)] p-4 flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-4)]">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-[var(--surface-1)] disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-[var(--surface-1)] disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedDecision && (
        <DecisionDetailModal
          decision={selectedDecision}
          onClose={() => setSelectedDecision(null)}
          onAction={(action) => {
            handleAction(action, selectedDecision.id).then(() => {
              setSelectedDecision((prev) => (prev ? { ...prev, status: "approved" } : null));
            });
          }}
        />
      )}
    </div>
  );
}