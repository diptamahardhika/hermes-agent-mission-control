import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

// Trigger file is local-only by design; see docs/local-only-paths.md
// TODO: Trigger files written to the local filesystem won't work on Vercel.
// This route needs to be reworked for serverless (e.g., use a database queue,
// Inngest, or a similar job system) when deploying to Vercel.
const TRIGGERS_DIR = "./data/triggers";

export async function POST(req: NextRequest) {
  const { id, title, hook, outline, message } = await req.json();

  if (!id || !message) {
    return NextResponse.json({ error: "id and message required" }, { status: 400 });
  }

  // Ensure triggers directory exists
  if (!fs.existsSync(TRIGGERS_DIR)) {
    fs.mkdirSync(TRIGGERS_DIR, { recursive: true });
  }

  // Write trigger file for Nova to pick up
  const trigger = {
    type: "longform-tweak",
    scriptId: id,
    title: title || "",
    hook: hook || "",
    outline: outline || "",
    message,
    createdAt: new Date().toISOString(),
  };

  const filename = `longform-tweak-${id}-${Date.now()}.json`;
  fs.writeFileSync(`${TRIGGERS_DIR}/${filename}`, JSON.stringify(trigger, null, 2));

  return NextResponse.json({ ok: true, trigger: filename });
}
