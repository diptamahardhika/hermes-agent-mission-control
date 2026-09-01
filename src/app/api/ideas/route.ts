export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ideasJson from "@/data/ideas.json" assert { type: "json" };

// Agent roster mirrors hermes profiles (see bridge.mjs "[agent]" routing).
// Max's cast id is "max" but his real Hermes profile is "default".
const AGENT_PROFILES: Record<string, string> = {
  max: "default",
  nova: "nova",
  sage: "sage",
  knox: "knox",
  pixel: "pixel",
};

function requestKey(ideaId: string) {
  return `idea-${ideaId}`;
}

type DispatchState = "queued" | "running" | "board" | "working" | "done" | "failed";

interface DispatchInfo {
  state: DispatchState;
  agent: string | null;
}

async function enrichWithDispatch(ideas: Array<{ id: string; agent: string | null }>) {
  const ids = ideas.map((i) => requestKey(i.id));
  const [requests, tasks] = await Promise.all([
    prisma.agentRequest.findMany({
      where: { hermesTaskId: { in: ids }, kind: "kanban" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hermesTask.findMany({ where: { board: "default" }, select: { id: true, status: true } }),
  ]);

  const latest = new Map<string, (typeof requests)[number]>();
  for (const r of requests) {
    const key = r.hermesTaskId as string;
    if (!latest.has(key)) latest.set(key, r);
  }
  const taskStatus = new Map(tasks.map((t) => [t.id, t.status]));

  const map = new Map<string, DispatchInfo | null>();
  for (const idea of ideas) {
    const r = latest.get(requestKey(idea.id));
    // Legacy rows approved before dispatch existed: approved but never sent.
    if (!r || !idea.agent) {
      map.set(idea.id, null);
      continue;
    }
    const agent = idea.agent;
    let info: DispatchInfo;
    if (r.status === "failed") {
      info = { state: "failed", agent };
    } else if (r.status === "running") {
      info = { state: "running", agent };
    } else if (r.status === "done") {
      const m = /"id"\s*:\s*"(t_[a-z0-9]+)"/.exec(r.result || "");
      const ts = m ? taskStatus.get(m[1]) : null;
      if (ts === "doing") info = { state: "working", agent };
      else if (ts === "done") info = { state: "done", agent };
      else if (m) info = { state: "board", agent };
      else info = { state: "running", agent }; // ran but no task id captured yet
    } else {
      info = { state: "queued", agent };
    }
    map.set(idea.id, info);
  }
  return map;
}

export async function GET() {
  let ideas = await prisma.idea.findMany({
    orderBy: { timestamp: "desc" },
  });

  // Fall back to static data if Prisma Idea table is empty (no migrations run yet)
  if (!ideas.length) {
    ideas = ideasJson.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description ?? null,
      status: i.status ?? null,
      model: i.model ?? null,
      type: i.type ?? null,
      category: i.category ?? null,
      source: i.source ?? null,
      estimatedTime: i.estimatedTime ?? null,
      agent: i.agent ?? null,
      rejectionReason: null,
      timestamp: new Date(),
      _source: "static-data",
    }));
  }

  const dispatch = await enrichWithDispatch(ideas);
  return NextResponse.json(
    ideas.map((i) => ({ ...i, dispatch: dispatch.get(i.id) ?? null })),
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });

  // ── Dispatch an approved idea to an agent ──────────────────────────
  if (body.action === "dispatch") {
    const { id, agent } = body;
    const profile = AGENT_PROFILES[agent];
    if (!id || !profile) {
      return NextResponse.json({ error: "id and valid agent required" }, { status: 400 });
    }
    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) return NextResponse.json({ error: "not found" }, { status: 404 });

    const prior = await prisma.agentRequest.findFirst({
      where: { hermesTaskId: requestKey(id), kind: "kanban" },
      orderBy: { createdAt: "desc" },
    });
    if (prior && prior.status !== "failed") {
      return NextResponse.json({ error: "already dispatched", requestId: prior.id }, { status: 409 });
    }

    const prompt = [
      idea.description || "",
      "",
      `Source: operator's idea board (Hermy HQ /ideas). Category: ${idea.category || "build"}. Estimated effort: ${idea.estimatedTime || "unspecified"}.`,
      "The operator approved this idea — pick it up and implement it end to end.",
    ].join("\n");

    const [, updated] = await Promise.all([
      prisma.agentRequest.create({
        data: {
          origin: "web",
          kind: "kanban",
          title: `[${profile}] Implement: ${idea.title}`.slice(0, 200),
          prompt,
          sideEffecting: true,
          status: "approved",
          hermesTaskId: requestKey(id),
        },
      }),
      prisma.idea.update({ where: { id }, data: { status: "approved", agent } }),
    ]);
    return NextResponse.json({ ok: true, idea: updated });
  }

  // ── Create a new idea (whitelisted — unknown keys made this 500 before) ──
  const title = (body.title || "").toString().trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const idea = await prisma.idea.create({
    data: {
      title,
      description: body.description || null,
      category: body.category || null,
      type: body.type || null,
      model: body.model || null,
      status: body.status || null,
      source: body.source || null,
      estimatedTime: body.estimatedTime || null,
    },
  });
  return NextResponse.json(idea);
}

const UPDATABLE = ["title", "description", "category", "type", "model", "status", "source", "estimatedTime", "agent", "rejectionReason"] as const;

export async function PUT(req: NextRequest) {
  const { id, ...raw } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of UPDATABLE) {
    if (key in raw) updates[key] = raw[key];
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
  }

  try {
    const idea = await prisma.idea.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json(idea);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.idea.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}