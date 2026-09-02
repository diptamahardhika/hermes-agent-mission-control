import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { homedir } from "os";

const execFileP = promisify(execFile);
const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;
const HERMES_BIN = `${homedir()}/.hermes/hermes-agent/venv/bin/hermes`;

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
    const out = await execFileP("sqlite3", [
      KANBAN_DB,
      "SELECT id FROM tasks WHERE assignee=? AND status='blocked';",
      agentId,
    ]).then(r => r.stdout).catch(() => "");
    taskIds = out.trim().split("\n").filter(Boolean);
  }

  if (taskIds.length === 0) {
    return NextResponse.json({ unblocked: 0, message: "No blocked tasks found" });
  }

  const results = [];
  for (const id of taskIds) {
    try {
      await execFileP(HERMES_BIN, ["kanban", "unblock", id], {
        timeout: 15000, maxBuffer: 1024 * 1024,
      });
      results.push({ id, ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id, ok: false, error: msg.slice(0, 200) });
    }
  }

  return NextResponse.json({ unblocked: taskIds.length, results });
}
