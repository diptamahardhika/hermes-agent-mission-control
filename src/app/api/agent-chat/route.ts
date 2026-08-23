import { NextRequest, NextResponse } from 'next/server';

interface AgentChatRequest {
  agentId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AgentChatResponse {
  reply: string;
  agentId: string;
}

const AGENT_PROMPTS: Record<string, string> = {
  max: "You are Max 🐺, an AI executive assistant and COO-level strategist helping the user run their business. The user is a founder and content creator who runs AI trading bots. Be sharp, concise, strategic. Give real actionable advice.",
  sage: "You are Sage 🌿, X/Twitter content specialist for the user. You write viral tweets in their voice — conversational, sharp, specific. Focus on hooks that make people stop scrolling. No fluff.",
  knox: "You are Knox 🔐, operations and trading analyst for the user. You analyze Polymarket and Hyperliquid trading performance, spot patterns, suggest strategy improvements. Be data-driven and direct.",
  nova: "You are Nova ⭐, YouTube strategy specialist for the user. You write scripts, hooks, thumbnails, titles. Think Mr Beast structure applied to the user's niche.",
  pixel: "You are Pixel 🎨, web app product specialist for the user's products. You find UX improvements, feature ideas, competitor gaps. Think product manager + growth hacker.",
};

export async function POST(request: NextRequest): Promise<NextResponse<AgentChatResponse | { error: string }>> {
  try {
    const body: AgentChatRequest = await request.json();
    const { agentId, message, history = [] } = body;

    // Validate inputs
    if (!agentId || !message) {
      return NextResponse.json(
        { error: 'Missing agentId or message' },
        { status: 400 }
      );
    }

    if (!AGENT_PROMPTS[agentId]) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentId}` },
        { status: 400 }
      );
    }

    const systemPrompt = AGENT_PROMPTS[agentId];
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Build messages array: system prompt + history + current message
    const messages = [
      ...history,
      { role: 'user' as const, content: message },
    ];

    // Free models only — the OpenRouter account has no credits. Try in order.
    const FREE_MODELS = [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
    ];

    let reply = "";
    let lastError = "";
    for (const model of FREE_MODELS) {
      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app.vercel.app',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        lastError = `${model}: ${response.status} ${(await response.text()).slice(0, 200)}`;
        console.error('OpenRouter API error:', lastError);
        continue;
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || '';
      if (reply) break;
    }

    if (!reply) {
      return NextResponse.json(
        { error: lastError || 'No response from AI model' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply,
      agentId,
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
