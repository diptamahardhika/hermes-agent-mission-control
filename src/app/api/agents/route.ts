import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { execFile } from "child_process";
import { homedir } from "os";
import { promisify } from "util";

const execFileP = promisify(execFile);

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Default agent roster
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
    role: "X Content Specialist \u00B7 Trend Scout",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "knox",
    name: "Knox",
    emoji: "\uD83D\uDD10",
    role: "Trading Operations \u00B7 Bot Monitor",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "nova",
    name: "Nova",
    emoji: "\u2B50",
    role: "YouTube Strategy \u00B7 Content Research",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "pixel",
    name: "Pixel",
    emoji: "\uD83C\uDFA8",
    role: "Web App Specialist \u00B7 Product Ideas",
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

type Live = { status: string; currentTask?: string; lastActive?: string };

// ── Hermes live state (local state.db) ──────────────────────
// A row in session_turn_leases with expires_at in the future means a turn is
// generating RIGHT NOW. Recent open sessions mean the runtime is in use.
async function hermesLive(): Promise<Live> {
  const db = `${homedir()}/.hermes/state.db`;
  const nowSql = "strftime('%s','now')";

  const leaseOut = await sh("sqlite3", [
    "-readonly", db,
    `SELECT l.conversation_id, s.title, s.last_activity_at
     FROM session_turn_leases l LEFT JOIN sessions s ON s.id = l.conversation_id
     WHERE l.expires_at > ${nowSql} ORDER BY s.last_activity_at DESC LIMIT 1;`,
  ]);

  if (leaseOut && leaseOut.trim()) {
    const [, title] = leaseOut.trim().split("|");
    return {
      status: "working",
      currentTask: title && title !== "" ? title.slice(0, 80) : "Working on a task",
      lastActive: new Date().toISOString(),
    };
  }

  const recentOut = await sh("sqlite3", [
    "-readonly", db,
    `SELECT datetime(MAX(last_activity_at), 'unixepoch'), COUNT(*)
     FROM sessions WHERE ended_at IS NULL AND last_activity_at > ${nowSql} - 900;`,
  ]);
  if (recentOut && recentOut.trim() && !recentOut.trim().startsWith("|")) {
    const [ts, count] = recentOut.trim().split("|");
    if (Number(count) > 0 && ts) {
      // epoch-ish sanity: only trust if we got a timestamp
      return {
        status: "idle",
        lastActive: new Date(Date.parse(ts.replace(" ", "T") + "Z") || Date.now()).toISOString(),
      };
    }
  }
  return { status: "offline" };
}

// ── OpenCode live state (~/.local/share/opencode/opencode.db) ──
async function opencodeLive(): Promise<Live> {
  const running = await sh("pgrep", ["-x", "opencode"]);
  if (!running || !running.trim()) return { status: "offline" };

  const db = `${homedir()}/.local/share/opencode/opencode.db`;
  const out = await sh("sqlite3", [
    "-readonly", db,
    `SELECT m.time_updated, s.title FROM message m
     JOIN session s ON s.id = m.session_id
     ORDER BY m.time_updated DESC LIMIT 1;`,
  ]);
  let lastActive: string | undefined;
  let currentTask: string | undefined;
  if (out && out.trim()) {
    const [msStr, title] = out.trim().split("|");
    const ms = Number(msStr);
    if (Number.isFinite(ms) && ms > 0) {
      lastActive = new Date(ms).toISOString();
      // Actively generating = a message landed in the last 3 minutes
      if (Date.now() - ms < 3 * 60 * 1000) {
        return {
          status: "working",
          currentTask: title ? title.replace(/^New session - .*/, "Coding session").slice(0, 80) : "Coding",
          lastActive,
        };
      }
    }
  }
  return { status: "idle", lastActive };
}

export async function GET() {
  try {
    const [states, hermes, opencode] = await Promise.all([
      prisma.agentState.findMany(),
      hermesLive(),
      opencodeLive(),
    ]);
    const stateMap: Record<string, any> = {};
    for (const s of states) {
      stateMap[s.id] = s;
    }

    // Real runtime → cast mapping: Max runs Hermes, Pixel runs OpenCode.
    const liveMap: Record<string, Live> = { max: hermes, pixel: opencode };

    const agents = DEFAULT_AGENTS.map((agent) => {
      const s = stateMap[agent.id] || {};
      const live = liveMap[agent.id];
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
        tasksCompleted: s.tasksCompleted || agent.tasksCompleted,
        totalCost: s.totalCost || agent.totalCost,
        recentActivity: s.recentActivity || agent.recentActivity,
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
    let existing = await prisma.agentState.findUnique({ where: { id: agentId } });

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
