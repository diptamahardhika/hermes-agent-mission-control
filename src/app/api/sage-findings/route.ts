export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { homedir } from "os";
import { promisify } from "util";
import { readFile } from "fs/promises";
import path from "path";

const execFileP = promisify(execFile);
const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;

export type SageCategory = "ai" | "security";

type Finding = {
  taskId: string;
  title: string;
  summary: string;
  completedAt: string;
  category: SageCategory;
};

// NB: no -readonly — macOS sqlite3 can't open a WAL db readonly if it needs
// recovery, and this DB is actively written by the gateway dispatcher.
const DIGEST_DIR = `${homedir()}/.hermes/sage-digests`;

async function sageFindings(): Promise<Finding[]> {
  try {
    const { stdout } = await execFileP("sqlite3", [
      "-json", KANBAN_DB,
      `SELECT r.task_id, t.title, r.summary, r.ended_at
       FROM task_runs r JOIN tasks t ON t.id = r.task_id
       WHERE t.assignee = 'sage' AND r.status = 'done' AND length(coalesce(r.summary,'')) > 50
       ORDER BY coalesce(r.ended_at, r.started_at) DESC LIMIT 10;`,
    ], { timeout: 5000, maxBuffer: 1024 * 1024 });
    if (!stdout.trim()) return [];
    const rows = JSON.parse(stdout.trim());
    const findings = await Promise.all(rows.map(async (r: any) => {
      let summary = String(r.summary || "");
      const title = String(r.title || "");
      // Prefer the durable digest file (full markdown with source links) over
      // the completion summary, which can get compressed by the dispatcher.
      try {
        const file = title.toLowerCase().includes("cyber")
          ? await readFile(path.join(DIGEST_DIR, "security-digest.md"), "utf8")
          : await readFile(path.join(DIGEST_DIR, "ai-digest.md"), "utf8");
        if (file.trim().length > summary.length) summary = file.trim();
      } catch { /* no digest file yet — fall back to summary */ }
      return {
        taskId: String(r.task_id),
        title,
        summary,
        completedAt: new Date((Number(r.ended_at) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        category: categorize(title),
      };
    }));
    return findings;
  } catch {
    return [];
  }
}

function categorize(title: string): SageCategory {
  return /cyber|securit|cve|vulnerab|threat|breach|ransom/i.test(title) ? "security" : "ai";
}

export async function GET() {
  const findings = await sageFindings();
  return NextResponse.json({ findings }, { headers: { "Cache-Control": "no-store, no-cache" } });
}
