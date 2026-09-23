import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("take"));
  const take = isNaN(raw) ? 500 : Math.min(raw, 1000);
  const tasks = await prisma.hermesTask.findMany({ orderBy: [{ status: "asc" }, { priority: "desc" }], take });
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
  const lastSync = tasks[0]?.syncedAt ?? null;
  return NextResponse.json({ tasks, counts, total: tasks.length, lastSync });
}
