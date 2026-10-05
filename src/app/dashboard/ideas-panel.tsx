"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { AccessibleTabList, AccessibleTabPanel } from "@/components/accessible-tabs";
import { IdeasSkeleton } from "@/components/dashboard/panel-skeletons";
import type { YTIdea, BuildIdea, BoardIdea, Draft } from "@/types/home-dashboard";

type IdeaTab = "board" | "x" | "youtube" | "builds";

const CATEGORY_LABEL: Record<string, string> = {
  build: "Build",
  content: "Content",
  feature: "Feature",
  thread: "Thread",
  experiment: "Experiment",
};
const CATEGORY_COLOR: Record<string, string> = {
  build: "#34d399",
  content: "#38bdf8",
  feature: "#a78bfa",
  thread: "#f0b132",
  experiment: "#fb7185",
};

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[var(--hq-text-ghost)] text-[13px] py-8 text-center">{children}</p>;
}

export default function IdeasPanel({ boardIdeas, sageDrafts, ytIdeas, buildIdeas }: {
  boardIdeas: BoardIdea[]; sageDrafts: Draft[]; ytIdeas: YTIdea[]; buildIdeas: BuildIdea[];
}) {
  const [tab, setTab] = useState<IdeaTab>("board");
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);
  const tabs: { key: IdeaTab; label: string; count: number }[] = [
    { key: "board", label: "Board", count: boardIdeas.length },
    { key: "x", label: "X", count: sageDrafts.length },
    { key: "youtube", label: "YouTube", count: ytIdeas.length },
    { key: "builds", label: "Builds", count: buildIdeas.length },
  ];

  return (
    <div className="panel flex flex-col p-6">
      {loading && <IdeasSkeleton />}
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Top Ideas</span>
        <AccessibleTabList
          idPrefix="ideas"
          panelId="ideas-tabpanel"
          ariaLabel="Idea sources"
          tabs={tabs.map((t) => ({
            key: t.key,
            label: <>{t.label}{t.count > 0 && <span className="ml-1 num text-[var(--hq-text-ghost)]">{t.count}</span>}</>,
          }))}
          activeTab={tab}
          onChange={setTab}
          className="flex gap-1 rounded-lg border border-[var(--hq-hairline)] p-0.5"
          buttonClassName={(active) => `px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${active ? "bg-white/[0.08] text-[var(--hq-text)]" : "text-[var(--hq-text-dim)] hover:text-[var(--hq-text)]"}`}
        />
      </div>

      <AccessibleTabPanel id="ideas-tabpanel" labelledBy={`ideas-tab-${tab}`} className="space-y-1 min-h-[172px]">
        {tab === "board" && (boardIdeas.length > 0 ? (
          <div>
            <div className="space-y-0">
              {boardIdeas.map((it, i) => {
                const catLabel = CATEGORY_LABEL[it.category] || it.category || "Build";
                const catColor = CATEGORY_COLOR[it.category] || "#34d399";
                const src = it.source && it.source !== "manual" ? `via ${it.source}` : null;
                return (
                  <a key={it.id} href="/ideas" className="group flex gap-3 items-start py-2.5 border-b border-[var(--hq-hairline)] last:border-0">
                    <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[var(--hq-text-dim)] text-[13px] font-medium leading-snug line-clamp-1 group-hover:text-[var(--hq-text)] transition-colors flex-1">{it.title}</p>
                        <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full num"
                          style={{ color: catColor, background: `${catColor}14`, border: `1px solid ${catColor}30` }}>
                          {catLabel}
                        </span>
                      </div>
                      {it.description && <p className="text-[var(--hq-text-ghost)] text-[12px] leading-snug line-clamp-2 mb-1.5">{it.description}</p>}
                      <div className="flex items-center gap-2 text-[10px] num text-[var(--hq-text-faint)]">
                        {src && <span>{src}</span>}
                        {it.estimatedTime && <span>· {it.estimatedTime}</span>}
                        {it.agent && <span>· @{it.agent}</span>}
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 mt-0.5 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                );
              })}
            </div>
            <a href="/ideas" className="mt-4 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              Open idea board <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        ) : <Empty>No active ideas on the board yet.</Empty>)}

        {tab === "x" && (sageDrafts.length > 0 ? sageDrafts.map((d, i) => (
          <a key={d.id} href="/x-content" className="group flex gap-3 items-center py-2 border-b border-[var(--hq-hairline)] last:border-0 hover:opacity-100 transition-opacity">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-[var(--hq-text-dim)] text-[13px] leading-snug line-clamp-1 flex-1 group-hover:text-[var(--hq-text)] transition-colors">{d.text}</p>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 transition-all group-hover:translate-x-0.5" />
          </a>
        )) : <Empty>No pending drafts.</Empty>)}

        {tab === "youtube" && (ytIdeas.length > 0 ? ytIdeas.map((it, idx) => (
          <a key={idx} href="/youtube" className="group flex gap-3 items-center py-2 border-b border-[var(--hq-hairline)] last:border-0">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
            <p className="text-[var(--hq-text-dim)] text-[13px] font-medium line-clamp-1 flex-1 group-hover:text-[var(--hq-text)] transition-colors">{it.title}</p>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--hq-text-ghost)] group-hover:text-[var(--hq-text-dim)] shrink-0 transition-all group-hover:translate-x-0.5" />
          </a>
        )) : <Empty>No YouTube ideas yet.</Empty>)}

        {tab === "builds" && (buildIdeas.length > 0 ? buildIdeas.map((it, idx) => (
          <div key={idx} className="flex gap-3 items-center py-2 border-b border-[var(--hq-hairline)] last:border-0">
            <span className="num text-[11px] text-[var(--hq-text-ghost)] w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
            <p className="text-[var(--hq-text-dim)] text-[13px] font-medium line-clamp-1 flex-1">{it.title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md num border shrink-0"
              style={it.effort === "quick win"
                ? { color: "var(--hq-up)", borderColor: "rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.08)" }
                : it.effort === "large"
                ? { color: "var(--hq-down)", borderColor: "rgba(251,113,133,0.25)", background: "rgba(251,113,133,0.08)" }
                : { color: "var(--hq-warn)", borderColor: "rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.08)" }}>
              {it.effort}
            </span>
          </div>
        )) : <Empty>No build ideas yet.</Empty>)}
      </AccessibleTabPanel>
    </div>
  );
}
