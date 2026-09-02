import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { homedir } from "os";

const FINDINGS_DIR = path.join(homedir(), ".hermes", "pixel-findings");

interface PixelFinding {
  id: string;
  timestamp: string;
  repo: string;
  branch: string;
  prNumber?: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: string;
  file?: string;
  line?: number;
  description: string;
  recommendation?: string;
  status: "open" | "acknowledged" | "resolved";
}

interface ReviewSummary {
  timestamp: string;
  repo: string;
  branch: string;
  prNumber?: number;
  status: "PASS" | "BLOCK" | "WARN";
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

// ── File-based storage ────────────────────────────────────────────────────────
async function ensureFindingsDir(): Promise<void> {
  await fs.mkdir(FINDINGS_DIR, { recursive: true });
}

async function saveFinding(finding: PixelFinding): Promise<void> {
  await ensureFindingsDir();
  const filePath = path.join(FINDINGS_DIR, `${finding.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(finding, null, 2));
}

async function saveReviewSummary(summary: ReviewSummary): Promise<string> {
  await ensureFindingsDir();
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `review-${summary.repo.replace("/", "-")}-${dateStr}-${summary.prNumber || "daily"}.json`;
  const filePath = path.join(FINDINGS_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2));
  return filePath;
}

async function listFindings(limit: number = 20): Promise<PixelFinding[]> {
  await ensureFindingsDir();
  try {
    const files = await fs.readdir(FINDINGS_DIR);
    const findings: PixelFinding[] = [];
    
    for (const file of files.slice(-limit)) {
      try {
        const content = await fs.readFile(path.join(FINDINGS_DIR, file), "utf-8");
        const finding = JSON.parse(content) as PixelFinding;
        findings.push(finding);
      } catch {}
    }
    
    return findings.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

async function getReviewHistory(repo?: string, limit: number = 10): Promise<ReviewSummary[]> {
  await ensureFindingsDir();
  try {
    const files = await fs.readdir(FINDINGS_DIR);
    const summaries: ReviewSummary[] = [];
    
    for (const file of files) {
      if (!file.startsWith("review-")) continue;
      if (repo && !file.includes(repo.replace("/", "-"))) continue;
      
      try {
        const content = await fs.readFile(path.join(FINDINGS_DIR, file), "utf-8");
        const summary = JSON.parse(content) as ReviewSummary;
        summaries.push(summary);
      } catch {}
    }
    
    return summaries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, limit);
  } catch {
    return [];
  }
}

// ── POST: Receive findings from webhook/handler ────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Handle different payload formats
    if (body.type === "finding") {
      const finding: PixelFinding = {
        id: body.id || `finding-${Date.now()}`,
        timestamp: body.timestamp || new Date().toISOString(),
        repo: body.repo,
        branch: body.branch,
        prNumber: body.prNumber,
        severity: body.severity,
        category: body.category,
        file: body.file,
        line: body.line,
        description: body.description,
        recommendation: body.recommendation,
        status: "open",
      };
      
      await saveFinding(finding);
      
      return NextResponse.json({ ok: true, id: finding.id });
    }
    
    if (body.type === "review-summary") {
      const summary: ReviewSummary = {
        timestamp: body.timestamp || new Date().toISOString(),
        repo: body.repo,
        branch: body.branch,
        prNumber: body.prNumber,
        status: body.status,
        findings: body.findings,
      };
      
      const filePath = await saveReviewSummary(summary);
      
      return NextResponse.json({ ok: true, saved: filePath });
    }
    
    return NextResponse.json({ error: "Unknown payload type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

// ── GET: List findings or review history ───────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "findings";
  const repo = searchParams.get("repo") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");
  
  if (type === "reviews") {
    const reviews = await getReviewHistory(repo, limit);
    return NextResponse.json({ reviews, count: reviews.length });
  }
  
  // Default: list findings
  const findings = await listFindings(limit);
  
  // Calculate aggregates
  const bySeverity: Record<string, number> = {};
  const byRepo: Record<string, number> = {};
  
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byRepo[f.repo] = (byRepo[f.repo] || 0) + 1;
  }
  
  return NextResponse.json({
    findings,
    count: findings.length,
    aggregates: {
      bySeverity,
      byRepo,
    },
  });
}

// ── GET: Health check ────────────────────────────────────────────────────────
export async function HEAD() {
  return NextResponse.json({ status: "ok", dir: FINDINGS_DIR });
}
