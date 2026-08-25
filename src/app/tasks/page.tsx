"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Pill, rise } from "@/components/ui/kit";

interface Task {
  id: string;
  name: string;
  details?: string;
  status: string;
  priority: string;
  category: string;
  tags?: string[];
  dueDate?: string;
}

const columns = [
  { id: "Not started", label: "To Do" },
  { id: "Approved", label: "Approved" },
  { id: "In progress", label: "In Progress" },
  { id: "Blocked", label: "Blocked" },
  { id: "Done", label: "Done" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formattingIds, setFormattingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch tasks");
      setTasks(data.tasks || []);
      setError(null);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
      setError(e instanceof Error ? e.message : "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }

  async function tidyTask(taskId: string, description: string) {
    setFormattingIds((prev) => new Set(prev).add(taskId));
    try {
      const fres = await fetch("/api/tasks/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const fdata = await fres.json().catch(() => null);
      if (!fres.ok) throw new Error(fdata?.error || "Failed to format task");
      const t = fdata.task;
      const pres = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          name: t.name,
          details: t.details,
          priority: t.priority,
          category: t.category,
          tags: t.tags,
        }),
      });
      const pdata = await pres.json().catch(() => null);
      if (!pres.ok) throw new Error(pdata?.error || "Failed to apply formatted task");
      setError(null);
      fetchTasks();
    } catch (e) {
      console.error("Format failed", e);
      setError(`hermes couldn't tidy "${description.slice(0, 50)}" — saved as-is, use the sparkles button on the card to retry`);
    } finally {
      setFormattingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }

  async function quickAdd() {
    const description = newTask.trim();
    if (!description) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: description, status: "Not started" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add task");
      const taskId: string = data.id;
      setNewTask("");
      setShowAddTask(false);
      setError(null);
      fetchTasks();
      tidyTask(taskId, description);
    } catch (e) {
      console.error("Failed to add task", e);
      setError(e instanceof Error ? e.message : "Failed to add task");
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      fetchTasks();
    } catch (e) {
      console.error("Failed to update task", e);
    }
  }

  if (loading) {
    return (
      <>
        <div className="relative z-10 w-full mx-auto pt-4">
          <div className="flex justify-between items-center mb-10">
            <div>
              <div className="sk h-3 w-20 mb-3" />
              <div className="sk h-7 w-28" />
            </div>
            <div className="sk h-9 w-28 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="panel p-4">
                <div className="sk h-4 w-16 mb-4" />
                <div className="space-y-2">
                  {[...Array(i + 1)].map((_, j) => <div key={j} className="sk h-16 rounded-[var(--r-md)]" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="relative z-10 h-full flex flex-col w-full mx-auto pt-4 pb-16">
        <div className="hq-rise flex justify-between items-end gap-4 mb-10" style={rise(0)}>
          <div>
            <div className="eyebrow mb-2">Synced with Obsidian</div>
            <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Tasks</h1>
          </div>
          <Button variant="primary" onClick={() => setShowAddTask(true)}>+ Add Task</Button>
        </div>

        {showAddTask && (
          <div className="hq-rise elevated mb-8 p-5">
            <textarea
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) quickAdd();
              }}
              placeholder="Describe the task roughly — hermes will tidy it up in the background"
              rows={3}
              className="w-full bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] rounded-[var(--r-md)] px-4 py-3 mb-3 text-[14px] focus:outline-none focus:border-[var(--line-strong)] resize-none"
              autoFocus
            />
            <div className="flex gap-2 items-center">
              <Button variant="primary" onClick={quickAdd} disabled={!newTask.trim()}>
                Add Task
              </Button>
              <Button variant="ghost" onClick={() => setShowAddTask(false)}>Cancel</Button>
              <span className="text-[11px] text-[var(--text-4)]">⌘↵ to add</span>
            </div>
          </div>
        )}

        {error && (
          <div className="hq-rise elevated mb-8 p-4 border border-red-500/40 bg-red-500/10 rounded-[var(--r-md)] flex items-center justify-between gap-4">
            <p className="text-[13px] text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[12px] text-red-300 hover:text-red-200 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 overflow-hidden">
          {columns.map((column, idx) => {
            const count = tasks.filter((t) => t.status === column.id).length;
            return (
              <div key={column.id} className="hq-rise panel flex flex-col overflow-hidden" style={rise(idx + 1)}>
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <span className="eyebrow">{column.label}</span>
                  <span className="num text-[11px] text-[var(--text-3)]">{count}</span>
                </div>
                <div className="rule" />
                <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
                  {tasks
                    .filter((t) => t.status === column.id)
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        done={column.id === "Done"}
                        formatting={formattingIds.has(task.id)}
                        onStatusChange={(status) => updateTaskStatus(task.id, status)}
                        onTidy={() => tidyTask(task.id, [task.name, task.details].filter(Boolean).join("\n"))}
                      />
                    ))}
                  {count === 0 && (
                    <p className="text-[var(--text-4)] text-[12.5px] text-center py-8">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function TaskCard({
  task,
  done,
  formatting,
  onStatusChange,
  onTidy,
}: {
  task: Task;
  done?: boolean;
  formatting?: boolean;
  onStatusChange: (status: string) => void;
  onTidy: () => void;
}) {
  const priorityTone: Record<string, "warn" | "neutral"> = {
    High: "warn",
    Medium: "neutral",
    Low: "neutral",
  };

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-1)] p-3.5 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)] cursor-pointer group">
      <p className={`font-medium text-[13px] leading-relaxed ${done ? "text-[var(--text-3)] line-through" : "text-[var(--text)]"} ${task.details ? "mb-1.5" : "mb-3"}`}>
        {task.name}
      </p>
      {task.details && (
        <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-3)] whitespace-pre-line line-clamp-3">
          {task.details}
        </p>
      )}
      {formatting && (
        <p className="mt-2 text-[11px] italic text-[var(--text-3)] animate-pulse">
          hermes is tidying this task…
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {task.priority && (
          <Pill tone={priorityTone[task.priority] || "neutral"}>{task.priority}</Pill>
        )}
        {task.category && (
          <span className="text-[11px] text-[var(--text-3)]">{task.category}</span>
        )}
        {(task.tags || []).map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--line)] text-[var(--text-3)]"
          >
            #{tag}
          </span>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--line)] opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <select
          className="flex-1 min-w-0 text-[12px] bg-[var(--surface-1)] text-[var(--text-2)] rounded-[var(--r-sm)] px-3 py-2 border border-[var(--line)] focus:outline-none focus:border-[var(--line-strong)]"
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              Move to {col.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onTidy}
          disabled={formatting}
          title="Tidy with hermes"
          className="shrink-0 inline-flex items-center justify-center rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface-1)] px-2.5 text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--line-strong)] transition-colors disabled:opacity-40"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
