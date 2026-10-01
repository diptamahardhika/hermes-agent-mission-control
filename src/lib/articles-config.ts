// Shared types and constants for the /articles route. Extracted from
// src/app/articles/page.tsx so the editor and calendar components can live
// outside the route file while still sharing one definition.
//
// Named articles-config rather than articles-types because this module is half
// runtime constants (TRACK_CONFIG, THEMES, STATUS_COLUMNS), not just types.
//
// The interfaces and type aliases emit no JavaScript, so pulling them here
// does not change the client bundle; the three constants are named ESM exports
// resolved once by the bundler, so there is no duplication.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Article {
  id: string;
  title: string;
  body: string;
  track: "mega-viral" | "local-viral" | "icp-viral";
  status: "idea" | "draft" | "ready" | "posted";
  qtTweet: string | null;
  qtUrl: string | null;
  heroImageUrl: string | null;
  heroImageHtml: string | null;
  inspirationUrls: string | null;
  themes: string | null;
  scheduledDate: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  impressions: number | null;
  likes: number | null;
  bookmarks: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedTitle {
  id: string;
  title: string;
  track: string;
  themes: string | null;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  searchUsed?: boolean;
}

export type Track = "mega-viral" | "local-viral" | "icp-viral";
export type Tab = "compose" | "library" | "calendar";

export const TRACK_CONFIG: Record<
  Track,
  {
    emoji: string;
    label: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  "mega-viral": {
    emoji: "🔴",
    label: "Mega Viral",
    description: "reCAPTCHA, Alexa, 23andMe energy. Designed to reach millions.",
    color: "text-[var(--text)]",
    bgColor: "bg-[var(--surface-2)]",
    borderColor: "border-[var(--line)]",
  },
  "local-viral": {
    emoji: "🟡",
    label: "Local Viral",
    description: "Claude features, AI tools, builder niche. Viral in our community.",
    color: "text-[var(--text)]",
    bgColor: "bg-[var(--surface-2)]",
    borderColor: "border-[var(--line)]",
  },
  "icp-viral": {
    emoji: "🟢",
    label: "ICP Viral",
    description: "Trojan horse content. Goes viral AND books calls from ideal clients.",
    color: "text-[var(--text)]",
    bgColor: "bg-[var(--surface-2)]",
    borderColor: "border-[var(--line)]",
  },
};

export const THEMES = [
  "AI",
  "Claude",
  "OpenClaw",
  "Marketing",
  "Crypto",
  "Productivity",
  "Builder Tools",
  "Agency",
  "Founders",
];

export const STATUS_COLUMNS = ["idea", "draft", "ready", "posted"] as const;
