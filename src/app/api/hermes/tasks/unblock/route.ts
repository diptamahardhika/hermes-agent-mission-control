import { NextResponse } from "next/server";
import { sh, KANBAN_DB } from "@/lib/kanban-db";
import { HERMES_BIN } from "@/lib/hermes-bin";

export async function POST(req: Request) {
  const { taskId, agentId } = await req.json() as { taskId?: string; agentId?: string };

  if (!taskId && !agentId) {
    return NextResponse.json({ error: "taskId or agentId required" }, { status: 400 });
  }

  // Collect task IDs to unblock
  let taskIds: string[] = [];
  if (taskId) {
    taskIds = [taskId];
  } else if (agentId) {
    const out = await sh(
      "sqlite3",
      [KANBAN_DB, "SELECT id FROM tasks WHERE assignee=? AND status='blocked';", agentId],
    );
    taskIds = (out || "").trim().split("\n").filter(Boolean);
  }

  if (taskIds.length === 0) {
    return NextResponse.json({ unblocked: 0, message: "No blocked tasks found" });
  }

  const results = [];
  for (const id of taskIds) {
    try {
      const { execFile } = await import("child_process");
      await new Promise<void>((resolve, reject) => {
        execFile(HERMES_BIN, ["kanban", "unblock", id], { timeout: 15000, maxBuffer: 1024 * 1024 }, (err) =>
          err ? reject(err) : resolve(),
        );
      });
      results.push({ id, ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id, ok: false, error: msg.slice(0, 200) });
    }
  }

  return NextResponse.json({ unblocked: taskIds.length, results });
}
