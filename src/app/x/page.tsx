"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

function TabSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="panel p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="sk w-8 h-8 rounded-full" />
            <div className="sk h-3 w-24 rounded" />
            <div className="sk h-5 w-16 rounded-full ml-auto" />
          </div>
          <div className="space-y-2">
            <div className="sk h-3 rounded w-full" />
            <div className="sk h-3 rounded w-4/5" />
            <div className="sk h-3 rounded w-3/5" />
          </div>
          <div className="flex gap-2 pt-1">
            {[...Array(4)].map((_, j) => <div key={j} className="sk h-6 w-16 rounded-lg" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

const ContentTab = dynamic(() => import("@/app/x-content/page"), { ssr: false, loading: () => <TabSkeleton /> });
const PerformanceTab = dynamic(() => import("@/app/x-analytics/page"), { ssr: false, loading: () => <TabSkeleton /> });
const TrendRadarTab = dynamic(() => import("@/app/watchlist-radar/page"), { ssr: false, loading: () => <TabSkeleton /> });

type Tab = "content" | "performance" | "radar";

export default function XPage() {
  const [tab, setTab] = useState<Tab>("content");

  const tabs: { key: Tab; label: string }[] = [
    { key: "content", label: "Content" },
    { key: "performance", label: "Performance" },
    { key: "radar", label: "Trend Radar" },
  ];

  return (
    <div className="space-y-0">
      <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">
        X
      </h1>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[var(--line)] mb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[13px] px-4 py-3 font-medium transition-colors relative whitespace-nowrap ${
              tab === t.key
                ? "text-[var(--text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <div className="absolute -bottom-px left-3 right-3 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content — strip full-page container styles from child pages */}
      <div className="[&>div]:min-h-0 [&>div]:pt-0 [&>div]:md\:pt-0 [&>div]:px-0 [&>div]:md\:px-0 [&>div]:p-0 [&>div]:md\:p-0 [&>div]:bg-transparent">
        {tab === "content" && <ContentTab />}
        {tab === "performance" && <PerformanceTab />}
        {tab === "radar" && <TrendRadarTab />}
      </div>
    </div>
  );
}
