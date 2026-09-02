import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { execFile } from "child_process";
import { homedir } from "os";
import { promisify } from "util";

const execFileP = promisify(execFile);

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Default agent roster — each maps to a REAL runtime:
// max/sage/knox/nova → Hermes kanban profiles (~/.hermes/profiles/<id>),
// pixel → OpenCode sessions. Status derives live in GET().
const DEFAULT_AGENTS = [
  {
    id: "max",
    name: "Max",
    emoji: "\uD83D\uDC3A",
    role: "Chief of Staff \u00B7 Orchestrator",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "sage",
    name: "Sage",
    emoji: "\uD83C\uDF3F",
    role: "AI Research Analyst \u00B7 Model News & Market Watch",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "knox",
    name: "Knox",
    emoji: "\uD83D\uDD10",
    role: "Ops/Infra Engineer \u00B7 Homelab & Monitoring",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "nova",
    name: "Nova",
    emoji: "\u2B50",
    role: "UI/UX Designer \u00B7 Product Interfaces",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "pixel",
    name: "Pixel",
    emoji: "\uD83C\uDFA8",
    role: "Repo Hygiene Engineer \u00B7 Codebase Cleanliness",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
];

function sh(cmd: string, args: string[], timeout = 5000): Promise<string | null> {
  return execFileP(cmd, args, { timeout, maxBuffer: 1024 * 1024 })
    .then((r) => r.stdout)
    .catch(() => null);
}

// ── Hermes kanban board (~/.hermes/state.db via `hermes` CLI schema) ──
// max/sage/knox/nova are real Hermes profiles. A task on the board assigned
// to <profile> with status running/todo/ready means that agent is busy.
const KANBAN_PROFILES = ["max", "sage", "knox", "nova", "pixel"] as const;

const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;

async function hermesKanbanLive(): Promise<Record<string, Live>> {
  // NB: no -readonly here — macOS sqlite3 can't open a WAL db readonly if it
  // needs recovery, and this DB is actively written by the gateway dispatcher.
  const out = await sh("sqlite3", [
    KANBAN_DB,
    `SELECT assignee, status, title FROM tasks
     WHERE status IN ('running','todo','ready','review','blocked')
     ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'ready' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END;`,
  ]);
  const map: Record<string, Live> = {};
  if (!out) return map;
  for (const line of out.trim().split("\n")) {
    if (!line) continue;
    const [assignee, status, title] = line.split("|");
    if (!assignee || !(KANBAN_PROFILES as readonly string[]).includes(assignee)) continue;
    if (!map[assignee]) {
      map[assignee] =
        status === "running"
          ? { status: "working", currentTask: (title || "Working").slice(0, 80), lastActive: new Date().toISOString() }
          : { status: "idle", currentTask: undefined };
      // queued work still counts as "has a task" but only running shows Working
    }
  }
  return map;
}

type Live = { status: string; currentTask?: string; lastActive?: string };

type Activity = { timestamp: string; action: string; result?: string };

// ── Recent activity + completed-task counts, derived live from kanban.db ──
// recentActivity used to depend on cron jobs POSTing an `action` to this
// route — nothing did, so every card showed empty history despite a full
// task board. Now we read the board directly (self-healing): every done
// task becomes an activity entry; done counts feed tasksCompleted.
// NB: Max runs on Hermes profile 'default' — remap here.
const ACTIVITY_PROFILE_MAP: Record<string, string> = { default: "max" };

async function hermesKanbanActivity(): Promise<{
  activity: Record<string, Activity[]>;
  doneCounts: Record<string, number>;
}> {
  const out = await sh("sqlite3", [
    KANBAN_DB,
    `SELECT assignee, title, completed_at, created_at FROM tasks
     WHERE status = 'done' AND assignee IS NOT NULL
     ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 200;`,
  ]);
  const activity: Record<string, Activity[]> = {};
  const doneCounts: Record<string, number> = {};
  if (!out) return { activity, doneCounts };
  for (const line of out.trim().split("\n")) {
    if (!line) continue;
    // Title may itself contain '|': last two fields are the timestamps.
    const parts = line.split("|");
    if (parts.length < 4) continue;
    const rawAssignee = parts[0];
    const createdAt = parts[parts.length - 1];
    const completedAt = parts[parts.length - 2];
    const title = parts.slice(1, -2).join("|");
    const agentId = ACTIVITY_PROFILE_MAP[rawAssignee] ?? rawAssignee;
    if (!(KANBAN_PROFILES as readonly string[]).includes(agentId)) continue;
    doneCounts[agentId] = (doneCounts[agentId] || 0) + 1;
    if ((activity[agentId]?.length ?? 0) >= 10) continue;
    const tsRaw = Number(completedAt) || Number(createdAt);
    if (!tsRaw || !title) continue;
    (activity[agentId] ||= []).push({
      timestamp: new Date(tsRaw * 1000).toISOString(),
      action: title.slice(0, 120),
    });
  }
  return { activity, doneCounts };
}

// ── Hermes interactive sessions (local state.db) → per-profile ──
// Each profile has its own state.db — query all of them for active leases.
async function hermesSessionLiveMap(): Promise<Record<string, Live>> {
  const nowSql = "strftime('%s','now')";
  const profiles = ["", "knox", "sage", "nova", "pixel"];
  const map: Record<string, Live> = {};

  // Check active turn leases in each profile's database
  for (const profile of profiles) {
    const db = profile
      ? `${homedir()}/.hermes/profiles/${profile}/state.db`
      : `${homedir()}/.hermes/state.db`;

    const leaseOut = await sh("sqlite3", [
      "-readonly", db,
      `SELECT l.conversation_id, s.title, s.last_activity_at
       FROM session_turn_leases l LEFT JOIN sessions s ON s.id = l.conversation_id
       WHERE l.expires_at > ${nowSql}
       ORDER BY s.last_activity_at DESC LIMIT 1;`,
    ]);

    if (leaseOut && leaseOut.trim()) {
      const parts = leaseOut.trim().split("|");
      const [, title] = parts;
      const agentId = profile === "" ? "max" : profile;
      if (!(KANBAN_PROFILES as readonly string[]).includes(agentId) || map[agentId]) continue;
      map[agentId] = {
        status: "working",
        currentTask: title && title !== "" ? title.slice(0, 80) : "Working on a task",
        lastActive: new Date().toISOString(),
      };
    }
  }

  // Detect active Hermes CLI processes — check recent activity for working/online
  const psOut = await sh("sh", [
    "-c",
    "ps aux | grep 'hermes_cli.main' | grep -v grep",
  ]);
  if (psOut && psOut.trim()) {
    for (const line of psOut.trim().split("\n")) {
      const profileMatch = line.match(/--profile\s+(\S+)/);
      if (!profileMatch) continue;
      const profile = profileMatch[1];
      const agentId = profile === "default" ? "max" : profile;
      if (!(KANBAN_PROFILES as readonly string[]).includes(agentId)) continue;

      // Already has an active turn lease — skip
      if (map[agentId]) continue;

      // Check recent session activity in the profile's database
      const db = profile
        ? `${homedir()}/.hermes/profiles/${profile}/state.db`
        : `${homedir()}/.hermes/state.db`;
      const activityOut = await sh("sqlite3", [
        "-readonly", db,
        `SELECT last_activity_at FROM sessions
         WHERE profile_name = '${agentId}'
         ORDER BY last_activity_at DESC LIMIT 1;`,
      ]);
      let lastActivity = Number(activityOut?.trim());

      // Fallback: most recent session if no profile_name match
      if (!lastActivity) {
        const recentOut = await sh("sqlite3", [
          "-readonly", db,
          `SELECT last_activity_at FROM sessions ORDER BY last_activity_at DESC LIMIT 1;`,
        ]);
        lastActivity = Number(recentOut?.trim());
      }

      if (lastActivity) {
        const now = Date.now() / 1000;
        // Show "working" if active within 2 minutes, otherwise "online"
        if (now - lastActivity <= 120) {
          map[agentId] = {
            status: "working",
            currentTask: "Active session",
            lastActive: new Date().toISOString(),
          };
        } else {
          map[agentId] = {
            status: "online",
            lastActive: new Date().toISOString(),
          };
        }
      }
    }
  }

  return map;
}


export async function GET() {
  try {
    const [states, sessionLiveMap, kanbanLive, kanbanActivity, healthRow] = await Promise.all([
      prisma.agentState.findMany(),
      hermesSessionLiveMap(),
      hermesKanbanLive(),
      hermesKanbanActivity(),
      prisma.dataStore.findUnique({ where: { key: "hermes-health" } }),
    ]);
    const stateMap: Record<string, any> = {};
    for (const s of states) {
      stateMap[s.id] = s;
    }

    // Real runtime → cast mapping: all five agents are Hermes kanban profiles.
    // max: interactive Hermes sessions (you talking to Hermes) OR his kanban tasks;
    // sage/knox/nova/pixel: their kanban profile tasks (running = Working).
    // Bridge health: when the hermes-bridge is connected, all five kanban-profile
    // agents (max/sage/knox/nova/pixel) are reachable even when they have no
    // running kanban task. Without this, the agents page shows them as static
    // idle dots while the bridge is actually up — a visual gap between the
    // in-app browser's agent list and hermy-hq's /agents view.
    // DataStore.data is JsonValue — cast to any since we control the shape written
    // by bridge.mjs mirrorHealth() (always { online, gateway, detail, lastSeen }).
    const healthData = (healthRow?.data as any) ?? {};
    const bridgeHealthy = healthData.online === true && healthData.gateway === "running";
    const liveMap: Record<string, Live> = {
      // NB: spread kanbanLive FIRST — the sessionLiveMap must win for any agent
      // that has an active interactive turn (interactive beats queued kanban).
      ...kanbanLive,
      ...sessionLiveMap,
    };

    // When the bridge is healthy but an agent has no running kanban task, mark it
    // online (pulsing) so the agents page reflects the real connected state instead
    // of a static idle dot.
    function bridgeFallback(live: Live | undefined): Live | undefined {
      if (!bridgeHealthy || live) return live; // kanbanLive already has a verdict
      return { status: "online" };
    }

    const agents = DEFAULT_AGENTS.map((agent) => {
      const s = stateMap[agent.id] || {};
      const live = bridgeFallback(liveMap[agent.id]);
      const status = live?.status ?? s.status ?? agent.status;
      const currentTask = live?.currentTask ?? (s.currentTask || undefined);
      const lastActive =
        live?.lastActive ??
        (s.lastActive ? new Date(s.lastActive).toISOString() : undefined);
      return {
        ...agent,
        status,
        currentTask: status === "working" ? currentTask : undefined,
        lastActive,
        tasksCompleted: kanbanActivity.doneCounts[agent.id] || s.tasksCompleted || agent.tasksCompleted,
        totalCost: s.totalCost || agent.totalCost,
        recentActivity: kanbanActivity.activity[agent.id] || s.recentActivity || agent.recentActivity,
      };
    });

    return NextResponse.json(agents, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Agents API error:", error);
    return NextResponse.json(DEFAULT_AGENTS, { status: 200 });
  }
}

// POST to update agent state (called by cron jobs)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, action, status, currentTask } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    // Find the default agent info for name/emoji/role
    const defaultAgent = DEFAULT_AGENTS.find((a) => a.id === agentId);

    // Get existing state or create defaults
    const existing = await prisma.agentState.findUnique({ where: { id: agentId } });

    const recentActivity = (existing?.recentActivity as any[]) || [];
    const newRecentActivity = action
      ? [
          { timestamp: new Date().toISOString(), action },
          ...recentActivity.slice(0, 19),
        ]
      : recentActivity;

    const updatedState = await prisma.agentState.upsert({
      where: { id: agentId },
      update: {
        ...(status ? { status } : {}),
        ...(currentTask !== undefined ? { currentTask } : {}),
        lastActive: new Date(),
        ...(action
          ? {
              recentActivity: newRecentActivity,
              tasksCompleted: (existing?.tasksCompleted || 0) + 1,
            }
          : {}),
      },
      create: {
        id: agentId,
        name: defaultAgent?.name || agentId,
        emoji: defaultAgent?.emoji,
        role: defaultAgent?.role,
        status: status || "idle",
        currentTask: currentTask || null,
        lastActive: new Date(),
        tasksCompleted: action ? 1 : 0,
        totalCost: 0,
        recentActivity: newRecentActivity,
      },
    });

    return NextResponse.json({ ok: true, agent: updatedState });
  } catch (error) {
    console.error("Agent update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
