import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const BOARD = process.env.HERMES_BOARD ?? "default";

export async function POST(req: Request) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  try {
    const { stdout } = await execFileP("hermes", [
      "kanban", "--board", BOARD, "unblock", id,
    ], { timeout: 15000, maxBuffer: 256 * 1024 });
    return NextResponse.json({ ok: true, id, output: stdout.trim() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return NextResponse.json({ ok: false, id, error: msg });
  }
}