"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";

function PanelSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse space-y-3 ${className}`}><div className="h-4 bg-[var(--hq-card)] rounded w-3/4" /><div className="h-4 bg-[var(--hq-card)] rounded w-1/2" /><div className="h-4 bg-[var(--hq-card)] rounded w-5/6" /></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[var(--hq-text-ghost)] text-[13px] py-8 text-center">{children}</p>;
}
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── AI model news panel ────────────────────────────
interface ModelCard {
  id: string;
  name: string;
  provider: string;
  source: string;
  contextLength: number | null;
  free: boolean;
  freeTier: "permanent-zero" | "quota" | "trial" | "no-card" | "unknown";
  freeTierDetail?: string;
  createdAt: number | null;
  inputs: string[];
  tags: string[];
  url?: string;
}
interface AINewsData { newModels: ModelCard[]; freeModels: ModelCard[]; totalFree: number; news: { title: string; url: string; source: string; publishedAt: number | null }[]; fetchedAt: string | null }

export function AIModelNewsPanel() {
  const [news, setNews] = useState<AINewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/ai-news").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setNews(d);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setError("Failed to load AI models & news");
    });
    const iv = setInterval(() => {
      fetch("/api/ai-news").then(r => r.ok ? r.json() : null).then(d => {
        if (d) setNews(d);
      }).catch(() => setError("Failed to refresh AI models & news"));
    }, 3600_000);
    return () => clearInterval(iv);
  }, []);

  const ctx = (n: number | null) => (n ? (n >= 1_000_000 ? `${(n / 1_048_576).toFixed(0)}M` : `${Math.round(n / 1024)}K`) : "—");

  const TAG_COLORS: Record<string, string> = {
    coding: "#38bdf8", vision: "#f0b132", reasoning: "#a78bfa",
    agents: "#34d399", fast: "#fb7185", "long-ctx": "#2dd4bf", audio: "#f97316",
  };
  const Tag = ({ t }: { t: string }) => (
    <span
      className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
      style={{ color: TAG_COLORS[t] || "var(--hq-text-dim)", background: `${TAG_COLORS[t] || "#888"}1a` }}
    >
      {t}
    </span>
  );

  const TIER_LABEL: Record<ModelCard["freeTier"], string> = {
    "permanent-zero": "FREE",
    quota: "QUOTA",
    trial: "TRIAL",
    "no-card": "NO CARD",
    unknown: "FREE",
  };
  const TIER_COLOR: Record<ModelCard["freeTier"], { text: string; bg: string }> = {
    "permanent-zero": { text: "#34d399", bg: "#34d399" },
    quota: { text: "#f0b132", bg: "#f0b132" },
    trial: { text: "#fb7185", bg: "#fb7185" },
    "no-card": { text: "#38bdf8", bg: "#38bdf8" },
    unknown: { text: "#888", bg: "#888" },
  };

  const Row = ({ m }: { m: ModelCard }) => {
    const tier = m.freeTier;
    const tierColor = TIER_COLOR[tier];
    const tierLabel = TIER_LABEL[tier];
    const linkUrl = m.url || `https://openrouter.ai/${m.id}`;

    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 py-1.5 border-b border-[var(--hq-hairline)] last:border-0 group"
      >
        <span className="text-[11px] text-[var(--hq-text-dim)] truncate flex-1 group-hover:text-[var(--hq-text)] transition-colors">{m.name}</span>
        <span className="shrink-0 flex gap-1">
          {m.tags.slice(0, 3).map((t) => <Tag key={t} t={t} />)}
          {m.source && (
            <span
              className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ color: "var(--hq-text-dim)", background: "var(--hq-card)", border: "1px solid var(--hq-border)" }}
              title={m.source}
            >
              {m.source}
            </span>
          )}
        </span>
        {m.free && (
          <span
            className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ color: tierColor.text, background: `${tierColor.bg}1a`, border: `1px solid ${tierColor.bg}33` }}
            title={m.freeTierDetail || tier}
          >
            {tierLabel}
          </span>
        )}
        <span className="num shrink-0 text-[10px] text-[var(--hq-text-ghost)]">{ctx(m.contextLength)}</span>
      </a>
    );
  };

  return (
      <div className="panel flex flex-col p-6">
        {loading && <PanelSkeleton />}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
          <span className="eyebrow">AI Models & News</span>
        </div>
        {error && (
          <div className="text-[12px] text-[var(--down)] py-4" role="alert">
            {error}
          </div>
        )}
        {!news ? (
          <PanelSkeleton />
        ) : news.newModels.length === 0 && news.freeModels.length === 0 && news.news.length === 0 ? (
          <Empty>No catalog or news data available right now.</Empty>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-8 gap-y-4">
          {/* Left: model lists */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <div className="eyebrow mb-1 !text-[11px]">NEW RELEASES · 30 DAYS</div>
              {news.newModels.length
                ? news.newModels.map(m => <Row key={m.id} m={m} />)
                : <Empty>None in the last 30 days.</Empty>}
            </div>
            <div>
              <div className="eyebrow mb-1 !text-[11px]">
                FREE MODELS{news.totalFree != null && <span className="num text-[var(--hq-text-ghost)] font-normal"> · {news.totalFree} live</span>}
              </div>
            <div className="flex-1 overflow-y-auto max-h-[340px] pr-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
              {news.freeModels.length
                ? news.freeModels.map(m => <Row key={m.id} m={m} />)
                : <Empty>No free models listed.</Empty>}
            </div>
            </div>
          </div>
          {/* Right: AI news headlines */}
          <div className="lg:col-span-2 lg:border-l lg:border-[var(--hq-hairline)] lg:pl-6">
            <div className="eyebrow mb-1 !text-[11px]">AI NEWS</div>
            {news.news.length
              ? news.news.map((n, i) => (
                  <a
                    key={`${n.url}-${i}`}
                    href={n.url}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-baseline gap-2 py-1.5 border-b border-[var(--hq-hairline)] last:border-0 group"
                  >
                    <span className="text-[11px] text-[var(--hq-text-dim)] leading-snug line-clamp-2 flex-1 group-hover:text-[var(--hq-text)] transition-colors">{n.title}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-[var(--hq-text-ghost)]">{n.source}</span>
                  </a>
                ))
              : <Empty>No headlines fetched.</Empty>}
          </div>
        </div>
      )}
      <div className="mt-auto pt-4 flex flex-wrap items-center gap-2 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors">
        <span className="text-[var(--hq-text-ghost)]">References:</span>
        <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hq-text)] transition-colors">OpenRouter</a>
        <span className="text-[var(--hq-text-ghost)]">·</span>
        <a href="https://freellm.net" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hq-text)] transition-colors">freellm.net</a>
        <span className="text-[var(--hq-text-ghost)]">·</span>
        <a href="https://freellms.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hq-text)] transition-colors">freellms.org</a>
        <span className="text-[var(--hq-text-ghost)]">·</span>
        <a href="https://freetoken.link/get-key" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hq-text)] transition-colors">freetoken.link</a>
        <span className="text-[var(--hq-text-ghost)]">·</span>
        <a href="https://github.com/open-free-llm-api/awesome-freellm-apis" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hq-text)] transition-colors">GitHub</a>
      </div>
    </div>
  );
}
