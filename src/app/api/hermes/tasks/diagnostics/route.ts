import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const BOARD = process.env.HERMES_BOARD ?? "default";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam) return NextResponse.json({});

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  const result: Record<string, string> = {};

  for (const id of ids) {
    try {
      const { stdout } = await execFileP("hermes", [
        "kanban", "--board", BOARD, "show", id,
      ], { timeout: 10000, maxBuffer: 256 * 1024 });

      // Extract error line from diagnostics
      const lines = stdout.split("\n");
      let errorLine = "";
      for (const line of lines) {
        if (line.includes("[error]")) {
          errorLine = line.replace(/^\s*!!\s*\[error\]\s*/, "");
          break;
        }
      }

      if (errorLine) {
        result[id] = errorLine;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      result[id] = `failed to fetch diagnostic: ${msg}`;
    }
  }

  return NextResponse.json(result);
}