export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { homedir } from "os";
import { promisify } from "util";

const execFileP = promisify(execFile);
const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;

// NB: no -readonly — macOS sqlite3 can't open a WAL db readonly if it needs
// recovery, and this DB is actively written by the gateway dispatcher.
async function sageFindings(): Promise<Array<{ taskId: string; title: string; summary: string; completedAt: string }>> {
  try {
    const { stdout } = await execFileP("sqlite3", [
      "-json", KANBAN_DB,
      `SELECT r.task_id, t.title, r.summary, r.ended_at
       FROM task_runs r JOIN tasks t ON t.id = r.task_id
       WHERE t.assignee = 'sage' AND r.status = 'done' AND length(coalesce(r.summary,'')) > 50
       ORDER BY coalesce(r.ended_at, r.started_at) DESC LIMIT 5;`,
    ], { timeout: 5000, maxBuffer: 1024 * 1024 });
    if (!stdout.trim()) return [];
    const rows = JSON.parse(stdout.trim());
    return rows.map((r: any) => ({
      taskId: String(r.task_id),
      title: String(r.title || "Research digest"),
      summary: String(r.summary || ""),
      completedAt: new Date((Number(r.ended_at) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const findings = await sageFindings();
  return NextResponse.json({ findings }, { headers: { "Cache-Control": "no-store, no-cache" } });
}
