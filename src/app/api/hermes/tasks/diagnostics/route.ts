import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const BOARD = process.env.HERMES_BOARD ?? "default";
const HERMES_BIN = process.env.HERMES_BIN ?? "hermes";

/** Only the fields this route reads out of `hermes kanban list --json`. */
interface KanbanTask {
  id: string;
  last_failure_error?: string | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam) return NextResponse.json({});

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  // One batched call for every id, instead of a `show` subprocess per id.
  // Per-id `show` cost ~700ms each and ran serially, so an 18-task board took
  // ~14s; the batched call returns the same board in ~0.8s. It is also more
  // complete: `show` omits the error line for some tasks (it dropped 3 of 18),
  // while `list --json` carries `last_failure_error` for every one of them.
  let tasks: KanbanTask[];
  try {
    // --archived keeps parity with the old per-id `show`, which resolved an
    // archived id. It costs ~17KB on a 608KB payload and no measurable time.
    const { stdout } = await execFileP(
      HERMES_BIN,
      ["kanban", "--board", BOARD, "list", "--json", "--archived"],
      { timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
    );
    // An unknown board makes the CLI exit non-zero with EMPTY stdout, and
    // JSON.parse("") throws — handled by the catch below, which returns the
    // per-id failure shape. The guard covers the other shape drift: a wrapper
    // returning {tasks:[…]} instead of a bare array would make tasks.map throw
    // a bare TypeError, i.e. an uncaught 500. Same defensive read the bridge
    // uses at hermes-bridge/bridge.mjs:393.
    const parsed: unknown = JSON.parse(stdout);
    tasks = Array.isArray(parsed) ? (parsed as KanbanTask[]) : [];
  } catch (e: unknown) {
    // Keep the old per-id failure shape so callers still render a message
    // instead of a bare 500.
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    const failed: Record<string, string> = {};
    for (const id of ids) failed[id] = `failed to fetch diagnostic: ${msg}`;
    return NextResponse.json(failed);
  }

  const byId = new Map(tasks.map((t) => [t.id, t.last_failure_error]));

  // Same contract as before: only tasks that actually failed appear in the
  // response, keyed by id.
  const result: Record<string, string> = {};
  for (const id of ids) {
    const err = byId.get(id);
    if (err) result[id] = err;
  }

  return NextResponse.json(result);
}
