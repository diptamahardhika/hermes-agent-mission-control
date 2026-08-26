import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Tasks are stored as markdown files in the user's Obsidian vault:
//   <OBSIDIAN_VAULT_PATH>/Hermes/Tasks/<task name>.md
// Frontmatter carries status/priority/category/tags; the filename is the task id.

type TaskValue = string | string[];

interface TaskData {
  name?: TaskValue;
  status?: TaskValue;
  priority?: TaskValue;
  category?: TaskValue;
  tags?: TaskValue;
  created?: TaskValue;
}

function tasksDir(): string {
  const vault = process.env.OBSIDIAN_VAULT_PATH;
  if (!vault) throw new Error("OBSIDIAN_VAULT_PATH is not set in .env");
  return path.join(vault, "Hermes", "Tasks");
}

function parseFrontmatter(content: string): { data: TaskData; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data: TaskData = {};
  if (match) {
    let lastKey = "";
    for (const line of match[1].split(/\r?\n/)) {
      const bullet = line.match(/^\s+-\s+(.+)$/);
      if (bullet && lastKey) {
        const existing = data[lastKey as keyof TaskData];
        const list = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
        list.push(bullet[1].trim());
        data[lastKey as keyof TaskData] = list;
        continue;
      }
      const idx = line.indexOf(":");
      if (idx > 0) {
        lastKey = line.slice(0, idx).trim();
        data[lastKey as keyof TaskData] = line.slice(idx + 1).trim();
      }
    }
    return { data, body: content.slice(match[0].length) };
  }
  return { data, body: content };
}

function serializeFrontmatter(data: TaskData): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "untitled";
}

async function uniqueFilePath(dir: string, base: string): Promise<string> {
  let filePath = path.join(dir, `${base}.md`);
  let n = 2;
  for (;;) {
    try {
      await fs.access(filePath);
      filePath = path.join(dir, `${base} ${n}.md`);
      n++;
    } catch {
      return filePath;
    }
  }
}

export async function GET() {
  try {
    const dir = tasksDir();
    await fs.mkdir(dir, { recursive: true });
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    const tasks: Array<{
      id: string;
      name: string;
      details: string;
      status: string;
      priority: string;
      category: string;
      tags: string[];
      dueDate: string | null;
    }> = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(content);
      const id = file.replace(/\.md$/, "");
      tasks.push({
        id,
        name: String(data.name || id),
        details: body.trim(),
        status: String(data.status || "Not started"),
        priority: String(data.priority || ""),
        category: String(data.category || ""),
        tags: Array.isArray(data.tags) ? data.tags : [],
        dueDate: null,
      });
    }
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Tasks API error:", error);
    const message = error instanceof Error ? error.message : "Failed to read tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, status, priority, category, details, tags } = await req.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Task name is required" }, { status: 400 });
    }
    const dir = tasksDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = await uniqueFilePath(dir, safeFileName(String(name)));
    const frontmatter = serializeFrontmatter({
      name: String(name).trim(),
      status: status || "Not started",
      priority: priority || "",
      category: category || "",
      tags: Array.isArray(tags) ? tags.map(String) : [],
      created: new Date().toISOString(),
    });
    const body = details && String(details).trim() ? `\n${String(details).trim()}\n` : "\n";
    await fs.writeFile(filePath, `${frontmatter}${body}`, "utf8");
    return NextResponse.json({ success: true, id: path.basename(filePath, ".md") });
  } catch (error) {
    console.error("Create task error:", error);
    const message = error instanceof Error ? error.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, name, details, priority, category, tags } = await req.json();
    if (!id || typeof id !== "string" || path.basename(id) !== id) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }
    const dir = tasksDir();
    const filePath = path.join(dir, `${id}.md`);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const { data, body } = parseFrontmatter(content);
    if (status !== undefined) data.status = status || "Not started";
    if (priority !== undefined) data.priority = priority || "";
    if (category !== undefined) data.category = category || "";
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.map(String) : [];
    let outBody = body;
    if (details !== undefined) {
      outBody = String(details).trim() ? `\n${String(details).trim()}\n` : "\n";
    }
    let outPath = filePath;
    if (name !== undefined && String(name).trim()) {
      const base = safeFileName(String(name));
      data.name = String(name).trim();
      if (`${base}.md` !== path.basename(filePath)) {
        outPath = await uniqueFilePath(dir, base);
      }
    }
    await fs.writeFile(outPath, `${serializeFrontmatter(data)}${outBody}`, "utf8");
    if (outPath !== filePath) {
      await fs.rm(filePath, { force: true });
    }
    return NextResponse.json({ success: true, id: path.basename(outPath, ".md") });
  } catch (error) {
    console.error("Update task error:", error);
    const message = error instanceof Error ? error.message : "Failed to update task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id || path.basename(id) !== id) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }
    const dir = tasksDir();
    const filePath = path.join(dir, `${id}.md`);
    try {
      await fs.rm(filePath);
    } catch {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
