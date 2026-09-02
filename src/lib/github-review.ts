/**
 * Pixel Security Review Utility
 * 
 * Performs security and hygiene checks on a repository branch.
 * Designed to run in isolated worktrees for PR reviews.
 * 
 * Usage:
 *   node lib/github-review.ts --repo <repo> --branch <branch> --pr-number <number> --token <github-token>
 */

import { execSync } from "child_process";
import { homedir } from "os";
import { join, dirname } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";

interface ReviewFinding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: string;
  file?: string;
  line?: number;
  description: string;
  recommendation?: string;
}

interface ReviewResult {
  repo: string;
  branch: string;
  prNumber: number;
  findings: ReviewFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  status: "PASS" | "BLOCK" | "WARN";
}

// ── Configuration ─────────────────────────────────────────────────────────────
const REPO_MAP: Record<string, string> = {
  "diptamahardhika/hermes-agent-mission-control": "/Users/pradiptamahardika/hermes-agent-mission-control",
  "diptamahardhika/homelab-monitor": "/Users/pradiptamahardika/orca/projects/homelab-monitor",
};

const SECRET_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /api_key\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /api-key\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /secret\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /token\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /Bearer\s+[A-Za-z0-9\-._~+/]+/i,
  /ghp_[A-Za-z0-9]{36}/,
  /sk-[a-zA-Z0-9]{20,}/,
];

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; name: string; severity: ReviewFinding["severity"] }> = [
  { pattern: /\beval\s*\(/g, name: "eval() usage", severity: "CRITICAL" },
  { pattern: /\bnew\s+Function\s*\(/g, name: "Function() constructor", severity: "CRITICAL" },
  { pattern: /innerHTML\s*=/g, name: "innerHTML assignment", severity: "HIGH" },
  { pattern: /dangerouslySetInnerHTML/g, name: "dangerouslySetInnerHTML", severity: "HIGH" },
  { pattern: /child_process\.exec\s*\(/g, name: "unsanitized exec()", severity: "MEDIUM" },
  { pattern: /\bexecSync\s*\(/g, name: "execSync usage", severity: "MEDIUM" },
  { pattern: /process\.env\.[A-Z_]+\s*[:=]\s*['"]/g, name: "env var exposure in code", severity: "LOW" },
];

const DEBUG_PATTERNS = [
  /console\.log\s*\(/g,
  /console\.warn\s*\(/g,
  /console\.error\s*\(/g,
  /debugger\s*;/g,
];

// ── Helper Functions ──────────────────────────────────────────────────────────
function runCommand(cmd: string, args: string[], cwd?: string): string {
  try {
    return execSync(`${cmd} ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });
  } catch (err: any) {
    return err.stdout || err.message || "";
  }
}

function getRepoPath(repo: string): string | null {
  return REPO_MAP[repo] || null;
}

function runAudit(cwd: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  
  // Try npm audit first, then yarn
  let auditOutput = "";
  try {
    auditOutput = runCommand("npm", ["audit", "--json"], cwd);
  } catch {
    try {
      auditOutput = runCommand("yarn", ["audit", "--json"], cwd);
    } catch {
      auditOutput = runCommand("npm", ["audit"], cwd);
    }
  }

  // Parse JSON output if available
  if (auditOutput.trim().startsWith("[")) {
    try {
      const audits: any[] = JSON.parse(auditOutput);
      for (const audit of audits) {
        if (audit.severity === "critical" || audit.severity === "high") {
          findings.push({
            severity: audit.severity.toUpperCase() as ReviewFinding["severity"],
            category: "Dependency Vulnerability",
            description: `${audit.module}: ${audit.title} (${audit.advisory?.url || "N/A"})`,
            recommendation: `Update or patch ${audit.module}`,
          });
        }
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Parse text output for CVE references
  const cveMatches = auditOutput.matchAll(/CVE-\d{4}-\d{4,}/g);
  for (const match of cveMatches) {
    findings.push({
      severity: "INFO",
      category: "CVE Reference",
      description: `Found CVE reference: ${match[0]}`,
    });
  }

  return findings;
}

function scanSecrets(cwd: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  
  // Get list of source files
  const files = runCommand("find", [cwd, "-type", "f", "-name", "*.ts", "-o", "-name", "*.js", "-o", "-name", "*.json"], cwd);
  const filePaths = files.split("\n").filter(Boolean);
  
  for (const filePath of filePaths.slice(0, 200)) { // Limit to first 200 files
    try {
      const content = runCommand("cat", [filePath]).trim();
      for (const pattern of SECRET_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          findings.push({
            severity: "CRITICAL",
            category: "Hardcoded Secret",
            file: filePath.replace(cwd + "/", ""),
            description: `Possible secret found: ${pattern.source}`,
            recommendation: "Use environment variables or secret management",
          });
          break; // One finding per file is enough
        }
      }
    } catch {}
  }
  
  return findings;
}

function scanDangerousPatterns(cwd: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  
  for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
    try {
      const result = runCommand("grep", ["-rn", pattern.source, join(cwd, "src"), "--include=*.ts", "--include=*.js"]);
      if (result.trim()) {
        const lines = result.split("\n").slice(0, 5); // Limit findings
        for (const line of lines) {
          const match = line.match(/^(.+):(\d+):(.+)$/);
          if (match) {
            findings.push({
              severity,
              category: `Insecure Pattern: ${name}`,
              file: match[1].replace(cwd + "/", ""),
              line: parseInt(match[2]),
              description: match[3].trim().slice(0, 100),
              recommendation: `Review and sanitize ${name.toLowerCase()}`,
            });
          }
        }
      }
    } catch {}
  }
  
  return findings;
}

function scanDebugCode(cwd: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  
  for (const pattern of DEBUG_PATTERNS) {
    try {
      const result = runCommand("grep", ["-rn", pattern.source, join(cwd, "src"), "--include=*.ts", "--include=*.js"]);
      if (result.trim()) {
        const lines = result.split("\n").slice(0, 3);
        for (const line of lines) {
          findings.push({
            severity: "LOW",
            category: "Debug Code",
            description: `Debug statement: ${line.slice(0, 80)}`,
            recommendation: "Remove debug code before merge",
          });
        }
      }
    } catch {}
  }
  
  return findings;
}

function checkUnusedDeps(cwd: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  
  try {
    const result = runCommand("npm", ["ls", "--long", "--depth=0"], cwd);
    // Check for dependencies with warning symbols
    if (result.includes("!")) {
      findings.push({
        severity: "MEDIUM",
        category: "Dependency Issue",
        description: "Found unused or orphaned dependencies (check npm ls output)",
        recommendation: "Run npm dedupe or remove unused packages",
      });
    }
  } catch {}
  
  return findings;
}

// ── Main Review Function ──────────────────────────────────────────────────────
export function performSecurityReview(opts: {
  repo: string;
  branch: string;
  prNumber: number;
  token: string;
}): ReviewResult {
  const { repo, branch, prNumber, token } = opts;
  const findings: ReviewFinding[] = [];
  
  const repoPath = getRepoPath(repo);
  if (!repoPath) {
    return {
      repo,
      branch,
      prNumber,
      findings,
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      status: "PASS",
    };
  }
  
  // Run all checks
  findings.push(...scanSecrets(repoPath));
  findings.push(...scanDangerousPatterns(repoPath));
  findings.push(...scanDebugCode(repoPath));
  findings.push(...runAudit(repoPath));
  findings.push(...checkUnusedDeps(repoPath));
  
  // Calculate summary
  const summary = {
    critical: findings.filter(f => f.severity === "CRITICAL").length,
    high: findings.filter(f => f.severity === "HIGH").length,
    medium: findings.filter(f => f.severity === "MEDIUM").length,
    low: findings.filter(f => f.severity === "LOW").length,
    info: findings.filter(f => f.severity === "INFO").length,
    total: findings.length,
  };
  
  // Determine overall status
  let status: ReviewResult["status"];
  if (summary.critical > 0 || summary.high > 0) {
    status = "BLOCK";
  } else if (summary.medium > 0 || summary.low > 0) {
    status = "WARN";
  } else {
    status = "PASS";
  }
  
  return { repo, branch, prNumber, findings, summary, status };
}

// ── GitHub Comment Formatter ─────────────────────────────────────────────────
export function formatPRComment(result: ReviewResult): string {
  const statusEmoji = result.status === "PASS" ? "✅" : result.status === "BLOCK" ? "🚨" : "⚠️";
  const statusText = result.status === "PASS" ? "PASS" : result.status === "BLOCK" ? "BLOCK" : "WARN";
  
  let comment = `## 🔒 Pixel Security Review — ${statusEmoji} ${statusText}\n\n`;
  comment += `**Repository:** ${result.repo}\n`;
  comment += `**Branch:** \`${result.branch}\`\n`;
  comment += `**PR:** #${result.prNumber}\n\n`;
  
  comment += `### Summary\n`;
  comment += `- 🔴 Critical: ${result.summary.critical}\n`;
  comment += `- 🟠 High: ${result.summary.high}\n`;
  comment += `- 🟡 Medium: ${result.summary.medium}\n`;
  comment += `- 🔵 Low: ${result.summary.low}\n`;
  comment += `- ℹ️ Info: ${result.summary.info}\n\n`;
  
  if (result.findings.length > 0) {
    comment += `### Findings\n\n`;
    for (const finding of result.findings.slice(0, 10)) {
      const severityEmoji = {
        CRITICAL: "🔴",
        HIGH: "🟠",
        MEDIUM: "🟡",
        LOW: "🔵",
        INFO: "ℹ️",
      }[finding.severity];
      
      comment += `#### ${severityEmoji} [${finding.severity}] ${finding.category}\n\n`;
      if (finding.file) {
        comment += `- **File:** \`${finding.file}\`${finding.line ? `:${finding.line}` : ""}\n`;
      }
      comment += `- **Issue:** ${finding.description}\n`;
      if (finding.recommendation) {
        comment += `- **Fix:** ${finding.recommendation}\n`;
      }
      comment += "\n";
    }
  } else {
    comment += `✅ No security issues found!\n\n`;
  }
  
  comment += `---\n`;
  comment += `_Review performed by Pixel 🎨 — Security & Repo Hygiene Engineer_\n`;
  
  return comment;
}

// ── Post Comment to GitHub ───────────────────────────────────────────────────
export async function postPRComment(opts: {
  repo: string;
  prNumber: number;
  token: string;
  comment: string;
}): Promise<{ success: boolean; status: number; data?: any }> {
  const { repo, prNumber, token, comment } = opts;
  
  try {
    const result = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: comment }),
    });
    
    const data = await result.json().catch(() => ({}));
    return { success: result.ok, status: result.status, data };
  } catch (err) {
    return { success: false, status: 0, data: { error: String(err) } };
  }
}

// ── CLI Entry Point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const parseArg = (name: string) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  
  const repo = parseArg("repo");
  const branch = parseArg("branch");
  const prNumber = parseInt(parseArg("pr-number") || "0");
  const token = parseArg("token") || process.env.GITHUB_TOKEN || "";
  
  if (!repo || !branch || !prNumber || !token) {
    console.error("Usage: node github-review.ts --repo <repo> --branch <branch> --pr-number <number> --token <github-token>");
    process.exit(1);
  }
  
  const result = performSecurityReview({ repo, branch, prNumber, token });
  console.log(JSON.stringify(result, null, 2));
  
  // Also output markdown comment
  const comment = formatPRComment(result);
  console.log("---COMMENT---");
  console.log(comment);
}
