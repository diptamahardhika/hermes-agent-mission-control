export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/errors";

/** One result from the Brave web-search API. */
type BraveResult = { title?: string; url?: string; description?: string };

/** The slice of Brave's search response this route reads. */
type BraveSearchResponse = { web?: { results?: BraveResult[] } };

async function braveSearch(query: string, braveKey: string, count = 5): Promise<{ title: string; url: string; description: string }[]> {
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": braveKey } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as BraveSearchResponse;
    return (data.web?.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      description: r.description || "",
    }));
  } catch {
    return [];
  }
}

// POST /api/articles/revise — chat-based article revision with optional web search
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, articleBody, track, instruction, searchEnabled, messages } = body;

    if (!instruction) {
      return NextResponse.json({ error: "instruction required" }, { status: 400 });
    }

    // Web search if enabled
    let searchContext = "";
    if (searchEnabled) {
      const braveKey = process.env.BRAVE_API_KEY || "";
      if (braveKey) {
        // Ask Sonnet to generate search queries based on the instruction
        const queryRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://your-app.vercel.app",
            "X-Title": "Hermy HQ Article Studio",
          },
          body: JSON.stringify({
            model: "anthropic/claude-sonnet-4-6",
            messages: [
              {
                role: "system",
                content: `You generate search queries to fact-check or research claims in articles. Given a user instruction and article context, output 1-3 short search queries that would help verify or research the topic. Return ONLY a JSON array of strings. No explanation.`,
              },
              {
                role: "user",
                content: `Article title: "${title}"\nUser instruction: "${instruction}"\n\nGenerate search queries to help with this request.`,
              },
            ],
            max_tokens: 200,
            temperature: 0.3,
          }),
        });

        if (queryRes.ok) {
          const queryData = await queryRes.json() as { choices: { message: { content: string } }[] };
          const queryContent = queryData.choices?.[0]?.message?.content?.trim() || "[]";
          try {
            const cleaned = queryContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
            const queries: string[] = JSON.parse(cleaned);
            const allResults = await Promise.all(
              queries.slice(0, 3).map((q) => braveSearch(q, braveKey, 3))
            );
            const flatResults = allResults.flat();
            if (flatResults.length > 0) {
              searchContext = `\n\n== WEB SEARCH RESULTS (use these to verify facts or update information) ==\n${flatResults
                .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.description}`)
                .join("\n\n")}`;
            }
          } catch {
            // Failed to parse queries, skip search
          }
        }
      }
    }

    // Build conversation history for context
    const historyMessages = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    const systemPrompt = `You are the user's article editor and fact-checker. You help revise and improve viral articles.

You have two modes:
1. REVISION MODE: When asked to change/improve the article, return a revised version of the FULL article body. Start your response with "REVISED_BODY:" followed by the complete revised article on the next line.
2. ANSWER MODE: When asked a question (fact-check, accuracy, research), answer the question directly. Do NOT prefix with "REVISED_BODY:".

== ARTICLE CONTEXT ==
Title: ${title}
Track: ${track}
Current article body:
${articleBody}
${searchContext}

== WRITING STYLE RULES ==
1. Short paragraphs — 2-3 sentences max, often just 1-2 lines
2. Numbers anchor every claim — be specific
3. No corporate speak — no "leverage", "harness", "unlock"
4. Write like telling a smart friend something they need to hear
5. Every section reveals something new — no filler
6. Use "you" to make the reader feel implicated
7. Proper sentence capitalization

When revising, maintain the article's voice and energy. Only change what was asked. Return the COMPLETE article body, not just the changed section.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app.vercel.app",
        "X-Title": "Hermy HQ Article Studio",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: instruction },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Failed to revise article" }, { status: 500 });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    if (!content) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 500 });
    }

    // Check if the response contains a revised body
    const isRevision = content.startsWith("REVISED_BODY:");
    if (isRevision) {
      const revisedBody = content.replace(/^REVISED_BODY:\s*/, "").trim();
      return NextResponse.json({
        type: "revision",
        message: "Article updated.",
        revisedBody,
        searchUsed: searchEnabled && searchContext.length > 0,
      });
    }

    return NextResponse.json({
      type: "answer",
      message: content,
      searchUsed: searchEnabled && searchContext.length > 0,
    });
  } catch (err) {
    console.error("POST /api/articles/revise error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
