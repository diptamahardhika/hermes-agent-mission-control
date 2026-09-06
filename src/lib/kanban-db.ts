import { execFile } from "child_process";
import { promisify } from "util";
import { homedir } from "os";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const execFileP = promisify(execFile) as any;

export const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;
export const TEMP_KANBAN_DB = "/tmp/hermes-db/kanban.db";

/**
 * Run sqlite3 on the kanban DB. Falls back to the bridge's temp copy
 * (/tmp/hermes-db/kanban.db) when the original is locked — this happens
 * when the Hermes gateway (running as root) leaves a root-owned
 * .dispatch.lock file that the bridge can't remove.
 */
export async function sh(
  cmd: string,
  args: string[],
  timeout = 5000,
): Promise<string | null> {
  try {
    const { stdout } = await execFileP(cmd, args, {
      timeout,
      maxBuffer: 1024 * 1024,
    });
    return typeof stdout === "string" ? stdout : String(stdout);
  } catch {
    // Fallback: retry with the bridge's temp copy (no root-owned lock)
    const modifiedArgs = args.map((a) =>
      a === KANBAN_DB ? TEMP_KANBAN_DB : a,
    );
    try {
      const { stdout } = await execFileP(cmd, modifiedArgs, {
        timeout,
        maxBuffer: 1024 * 1024,
      });
      return typeof stdout === "string" ? stdout : String(stdout);
    } catch {
      return null;
    }
  }
}

/**
 * Run a sqlite3 query that returns JSON rows.
 * Returns an empty array on failure (locked DB, parse error, etc.).
 */
export async function shJson<T = any>(sql: string): Promise<T[]> {
  const out = await sh("sqlite3", ["-json", KANBAN_DB, sql]);
  if (!out) return [];
  try {
    const text = out.trim();
    if (!text) return [];
    return JSON.parse(text);
  } catch {
    return [];
  }
}
