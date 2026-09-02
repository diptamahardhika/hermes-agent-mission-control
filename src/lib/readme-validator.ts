import { execSync } from "child_process";
import { join, dirname } from "path";

interface ExampleResult {
  file: string;
  line: number;
  code: string;
  status: "PASS" | "FAIL";
  error?: string;
}

interface ReadmeValidationResult {
  repo: string;
  examples: ExampleResult[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    warnings: number;
  };
  status: "PASS" | "WARN" | "FAIL";
}

// ── Extract code examples from README.md ─────────────────────────────────────
function extractCodeExamples(content: string): Array<{file: string; line: number; code: string}> {
  const examples: Array<{file: string; line: number; code: string}> = [];
  const lines = content.split('\n');
  
  // Patterns for different code block types
  const patterns = [
    { regex: /```(\w+)\n?/, type: 'code' },
    { regex: /`([^`\n]+)`/, type: 'inline' },
    { regex: /> \`[^\`]+\`/, type: 'bash' },
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip comments and headings
    if (line.startsWith('>') || line.startsWith('#') || line.startsWith('!')) {
      continue;
    }
    
    // Match code blocks
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        let code = '';
        
        // For code blocks, collect multiple lines
        if (pattern.type === 'code' && line.includes('```')) {
          const blockType = match[1];
          let j = i + 1;
          while (j < lines.length && !lines[j].includes('```')) {
            code += lines[j] + '\n';
            j++;
          }
          // Extract file path if mentioned in same line
          const fileMatch = line.match(/\(([^)]+)\)/);
          const file = fileMatch ? fileMatch[1] : '';
          examples.push({ file, line: i + 1, code: code.trim() });
        } else if (pattern.type === 'inline') {
          examples.push({ file: '', line: i + 1, code: match[1] });
        } else if (pattern.type === 'bash' && line.includes('>')) {
          // Extract bash examples after "> " prefix
          const bashCode = line.replace(/^>\s*/, '').replace(/\`([^\`]+)\`/, '$1');
          examples.push({ file: '', line: i + 1, code: bashCode });
        }
      }
    }
  }
  
  return examples;
}

// ── Validate code examples by attempting to run them ─────────────────────────
function validateExample(example: {file: string; line: number; code: string}, repoPath: string): ExampleResult {
  const workingDir = example.file ? join(repoPath, dirname(example.file)) : repoPath;
  const code = example.code.trim();
  
  // Determine command based on code type
  let command: string;
  let args: string[];
  
  // Detect command type from code
  if (code.startsWith('npm') || code.startsWith('yarn')) {
    command = 'sh';
    args = ['-c', code];
  } else if (code.startsWith('cat ') || code.startsWith('grep ') || code.startsWith('find ')) {
    // Simple shell commands
    command = 'sh';
    args = ['-c', code];
  } else if (code.startsWith('git ')) {
    command = 'sh';
    args = ['-c', code];
  } else {
    // Try to detect language from backticks or context
    if (code.includes('function ') || code.includes('=>') || code.includes('const ') || code.includes('import ')) {
      // Try to validate TypeScript/JavaScript syntax
      command = 'node';
      args = ['-c', code];
    } else {
      return {
        file: example.file,
        line: example.line,
        code: example.code,
        status: "WARN",
        error: "Unable to determine validation method",
      };
    }
  }
  
  try {
    // For security, only run simple, safe commands
    const safeCommands = ['sh', 'node', 'npm', 'yarn', 'git', 'cat', 'grep', 'find', 'ls', 'echo'];
    if (!safeCommands.includes(command)) {
      return {
        file: example.file,
        line: example.line,
        code: example.code,
        status: "FAIL",
        error: `Unsafe command: ${command}`, 
      };
    }
    
    // Execute with timeout and limited output
    execSync(command, {
      args,
      cwd: workingDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    
    return {
      file: example.file,
      line: example.line,
      code: example.code,
      status: "PASS",
    };
  } catch (err) {
    return {
      file: example.file,
      line: example.line,
      code: example.code,
      status: "FAIL",
      error: err instanceof Error ? err.message.slice(0, 100) : String(err),
    };
  }
}

// ── Main README validator function ────────────────────────────────────────────
export function validateReadmeExamples(repoPath: string): ReadmeValidationResult {
  let readmePath: string;
  
  // Look for README.md in various locations
  const possiblePaths = [
    join(repoPath, 'README.md'),
    join(repoPath, 'docs', 'README.md'),
    join(repoPath, 'docs', 'api', 'README.md'),
    join(repoPath, 'frontend', 'README.md'),
    join(repoPath, 'backend', 'README.md'),
  ];
  
  for (const path of possiblePaths) {
    if (require('fs').existsSync(path)) {
      readmePath = path;
      break;
    }
  }
  
  if (!readmePath) {
    return {
      repo: repoPath,
      examples: [],
      summary: { total: 0, pass: 0, fail: 0, warnings: 0 },
      status: "FAIL",
    };
  }
  
  const content = require('fs').readFileSync(readmePath, 'utf-8');
  const examples = extractCodeExamples(content);
  const results = examples.map(example => validateExample(example, repoPath));
  
  const summary = {
    total: results.length,
    pass: results.filter(r => r.status === "PASS").length,
    fail: results.filter(r => r.status === "FAIL").length,
    warnings: results.filter(r => r.status === "WARN").length,
  };
  
  let status: ReadmeValidationResult["status"] = "PASS";
  if (summary.fail > 0) status = "FAIL";
  else if (summary.warnings > 0) status = "WARN";
  
  return {
    repo: repoPath,
    examples: results,
    summary,
    status,
  };
}

// ── CLI Entry Point ────────────────────────────────────────────────────────────
if (require.main === module) {
  const repoPath = process.argv[2];
  
  if (!repoPath) {
    console.error('Usage: node readme-validator.js <repo-path>');
    process.exit(1);
  }
  
  const result = validateReadmeExamples(repoPath);
  console.log(JSON.stringify(result, null, 2));
  
  // Exit with appropriate code
  process.exit(result.status === "PASS" ? 0 : 1);
}
