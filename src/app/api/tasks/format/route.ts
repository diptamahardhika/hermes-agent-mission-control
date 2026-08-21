import { NextResponse } from "next/server";

// Formats a rough task description into a clean structured task using
// Claude Haiku via OpenRouter (same pattern as /api/agent-chat).

interface FormattedTask {
  name: string;
  details: string;
  priority: string;
  category: string;
  tags?: string | string[];
}

function extractJson(content: string): FormattedTask | null {
  const stripped = content.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { description } = await req.json();
    if (!description || !String(description).trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY is not set in .env" }, { status: 500 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [
          {
            role: "system",
            content: `You format rough task descriptions into clean, structured tasks for a kanban board. Return ONLY valid JSON, no other text, with exactly these keys:
- "name": short imperative title, max 80 characters, no trailing period
- "details": 2-5 concise markdown bullet points (each line starting with "- ") capturing the specifics: quantities, specs, vendors, links, deadlines, context from the description. No heading, no blank first line.
- "priority": "High", "Medium", or "Low" based on urgency cues in the description (default "Medium")
- "category": 1-2 word category like "Procurement", "Research", "Admin", "Content", "Infra"
- "tags": array of 2-4 short lowercase kebab-case topic tags (e.g. ["laptop", "procurement", "dsid"]) useful for finding this note in Obsidian
Keep every concrete fact from the description. Do not invent facts.`,
          },
          { role: "user", content: String(description) },
        ],
        max_tokens: 900,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("OpenRouter format error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Failed to format task" },
        { status: res.status }
      );
    }

    const content = data.choices?.[0]?.message?.content || "";
    const task = extractJson(content);
    if (!task || !task.name) {
      return NextResponse.json({ error: "Could not parse formatted task" }, { status: 500 });
    }

    const priority = ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium";
    const rawDetails = Array.isArray(task.details) ? task.details.join("\n") : String(task.details || "");
    const rawTags = Array.isArray(task.tags) ? task.tags : task.tags ? [task.tags] : [];
    const tags = [
      ...new Set(
        rawTags
          .map((t) =>
            String(t)
              .trim()
              .toLowerCase()
              .replace(/^#/, "")
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9\-_/]/g, "")
          )
          .filter(Boolean)
      ),
    ].slice(0, 4);
    return NextResponse.json({
      task: {
        name: String(task.name).slice(0, 200),
        details: rawDetails.trim(),
        priority,
        category: String(task.category || "").slice(0, 40),
        tags,
      },
    });
  } catch (error) {
    console.error("Format task error:", error);
    const message = error instanceof Error ? error.message : "Failed to format task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
