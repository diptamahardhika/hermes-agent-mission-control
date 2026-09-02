import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { createHmac, timingSafeEqual } from "crypto";

const execFileP = promisify(execFile);
const KANBAN_DB = `${homedir()}/.hermes/kanban.db`;
const HERMES_BIN = `${homedir()}/.hermes/hermes-agent/venv/bin/hermes`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Signature verification ────────────────────────────────────────────────────
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = `sha256=${createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")}`;
  try {
    const a = Buffer.from(signature.replace("sha256=", ""), "hex");
    const b = Buffer.from(expected.replace("sha256=", ""), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Enqueue Pixel review task ────────────────────────────────────────────────
async function enqueuePixelReview(
  repo: string,
  prNumber: number,
  branch: string,
  commitSha: string,
  prTitle: string
): Promise<string> {
  const taskId = `pixel-pr-${repo}-${prNumber}-${Date.now()}`;
  const body = `Security & hygiene review for PR #${prNumber} in ${repo}.
Branch: ${branch}
Commit: ${commitSha}
Title: ${prTitle}

Review checklist:
- [ ] npm audit for HIGH/CRITICAL findings
- [ ] Hardcoded secrets/tokens in src/
- [ ] Insecure patterns (eval, innerHTML, unsanitized exec)
- [ ] Console.log/debug leftovers
- [ ] TODO/FIXME/HACK comments introduced in PR

Post findings as a comment on the PR via GitHub API.`;

  await execFileP(HERMES_BIN, [
    "kanban",
    "--board",
    "default",
    "create",
    "--json",
    "--idempotency-key",
    `pixel-pr-review-${repo}-${prNumber}`,
    "--assignee",
    "pixel",
    taskId,
    "--body",
    body,
    "--workspace",
    `worktree:/Users/pradiptamahardika/${repo.split("/")[1]}`,
  ]);

  return taskId;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const action = req.headers.get("x-github-event") || "";
  const deliveryId = req.headers.get("x-github-delivery") || "unknown";

  // Verify signature
  if (!verifySignature(raw, signature)) {
    console.error("[webhook] Signature verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle ping event
  if (action === "ping") {
    console.log(`[webhook] Ping received: ${deliveryId}`);
    return NextResponse.json({ ok: true, message: "Webhook configured successfully" });
  }

  // Handle pull_request events
  if (action === "pull_request" && payload.pull_request) {
    const pr = payload.pull_request;
    const repoName = payload.repository?.full_name || "unknown";
    const prNumber = pr.number;
    const branch = pr.head?.ref || "unknown";
    const sha = pr.head?.sha || "unknown";
    const title = pr.title || "Untitled PR";
    const actionType = payload.action || "unknown";

    // Only review on open or synchronize (not close/merge/reopen)
    if (actionType === "opened" || actionType === "synchronize") {
      console.log(`[webhook] PR #${prNumber} ${actionType} in ${repoName}`);
      
      try {
        const taskId = await enqueuePixelReview(repoName, prNumber, branch, sha, title);
        console.log(`[webhook] Pixel review task enqueued: ${taskId}`);
        
        return NextResponse.json({
          ok: true,
          message: `Pixel security review enqueued for PR #${prNumber}`,
          taskId,
          prUrl: pr.html_url,
        });
      } catch (err) {
        console.error("[webhook] Failed to enqueue task:", err);
        return NextResponse.json(
          { error: "Failed to enqueue review task", detail: String(err) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, skipped: true, reason: `Action '${actionType}' not reviewed` });
  }

  // Handle pull_request_review events (for approval tracking)
  if (action === "pull_request_review" && payload.review) {
    const pr = payload.pull_request;
    console.log(`[webhook] PR #${pr.number} review: ${payload.review.state}`);
    return NextResponse.json({ ok: true, reviewState: payload.review.state });
  }

  return NextResponse.json({ ok: true, message: "Webhook received, no action taken" });
}

// ── Health check ──────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: "ok",
    webhookConfigured: !!WEBHOOK_SECRET,
    githubTokenSet: !!GITHUB_TOKEN,
    message: "GitHub PR open webhook endpoint",
  });
}
