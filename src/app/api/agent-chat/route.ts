import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { execSync } from 'child_process';

const execFileP = promisify(execFile);

interface AgentChatRequest {
  agentId: string;
  message: string;
}

const AGENTS = ['max', 'sage', 'knox', 'nova', 'pixel'] as const;
type AgentId = typeof AGENTS[number];

function profileHome(agent: string): string {
  // Max runs on the main Hermes home; others have per-profile homes.
  return agent === 'max' ? `${homedir()}/.hermes` : `${homedir()}/.hermes/profiles/${agent}`;
}

function lastAssistantId(agent: string): number {
  const db = `${profileHome(agent)}/state.db`;
  try {
    const out = execSync(
      `sqlite3 -json '${db}' "SELECT MAX(id) AS maxid FROM messages WHERE role='assistant'"`,
      { timeout: 10_000, maxBuffer: 1024 * 1024 },
    ).toString();
    const rows = JSON.parse(out.trim() || '[]');
    return rows[0]?.maxid ?? 0;
  } catch {
    return 0;
  }
}

function firstReplyAfter(agent: string, minId: number): string {
  const db = `${profileHome(agent)}/state.db`;
  try {
    const out = execSync(
      `sqlite3 -json '${db}' "SELECT content FROM messages WHERE role='assistant' AND id > ${minId} AND length(trim(content)) > 0 AND content NOT LIKE '{%' ORDER BY id ASC LIMIT 1"`,
      { timeout: 10_000, maxBuffer: 1024 * 1024 },
    ).toString();
    const rows = JSON.parse(out.trim() || '[]');
    return rows[0]?.content ?? '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: AgentChatRequest = await request.json();
    const agentId = body.agentId;
    const message = (body.message || '').trim();
    if (!agentId || !message) {
      return NextResponse.json({ error: 'Missing agentId or message' }, { status: 400 });
    }
    if (!(AGENTS as readonly string[]).includes(agentId)) {
      return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
    }

    const home = profileHome(agentId);
    // Snapshot the latest assistant message id BEFORE the run so concurrent
    // writes from other processes can't pollute the reply extraction.
    const beforeId = lastAssistantId(agentId);

    // Run the real Hermes agent with its own SOUL.md persona (one-shot, tools enabled).
    // Long replies can take a while — cap at 4 minutes.
    // Persistent session per agent (continuity = real relationship), but frame each
    // message as a fresh question so prior topics don't bleed into the answer.
    const framedMessage = `[New question from Dipta — answer this directly] ${message}`;
    await execFileP(
      `${homedir()}/.hermes/hermes-agent/venv/bin/hermes`,
      ['chat', '-q', framedMessage],
      { timeout: 240_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, HERMES_HOME: home } },
    );

    let reply = '';
    for (let attempt = 0; attempt < 10 && !reply; attempt++) {
      await new Promise(res => setTimeout(res, 3000));
      reply = firstReplyAfter(agentId, beforeId);
    }
    return NextResponse.json({ reply: reply || '(no reply captured)', agentId });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Agent failed to respond', detail: String(error).slice(0, 300) },
      { status: 502 },
    );
  }
}
