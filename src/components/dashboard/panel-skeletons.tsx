"use client";
import React from "react";

/* ── Shared primitives ─────────────────────────────────── */

function SkBar({ w, h = "h-2" }: { w: string; h?: string }) {
  return <div className={`sk ${h} ${w} rounded`} />;
}


/* ── 1. IdeasSkeleton ──────────────────────────────────── */

export function IdeasSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Top Ideas</span>
        <div className="flex gap-1 rounded-lg border border-[var(--hq-hairline)] p-0.5">
          {["Board", "X", "YouTube", "Builds"].map((t) => (
            <div key={t} className="px-2.5 py-1 rounded-md sk h-5 w-14" />
          ))}
        </div>
      </div>
      <div className="space-y-1 min-h-[172px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--hq-hairline)] last:border-0">
            <div className="sk h-3 w-3 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkBar w="w-3/4" />
              <SkBar w="w-full h-3" />
            </div>
            <div className="sk h-4 w-12 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 2. TweetsSkeleton ─────────────────────────────────── */

export function TweetsSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="sk h-3.5 w-3.5 rounded" />
        <span className="eyebrow">Top Tweets · 7d</span>
      </div>
      <div className="space-y-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-[var(--hq-hairline)] last:border-0">
            <div className="sk h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkBar w="w-2/3 h-3.5" />
              <SkBar w="w-full h-3" />
              <SkBar w="w-1/2 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 3. XAnalyticsSkeleton ─────────────────────────────── */

export function XAnalyticsSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="sk h-3.5 w-3.5 rounded" />
        <span className="eyebrow">X Analytics</span>
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Views · 7d</div>
          <div className="sk h-[40px] w-48 rounded" />
          <div className="sk h-9 w-full rounded mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {[
            { label: "Total tweets", w: "w-20" },
            { label: "Best day", w: "w-24" },
            { label: "Best hour", w: "w-20" },
            { label: "Avg replies", w: "w-20" },
          ].map((s) => (
            <div key={s.label}>
              <div className="eyebrow mb-1.5 !text-[9.5px]">{s.label}</div>
              <div className={`sk h-5 ${s.w} rounded`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 4. SpendSkeleton ──────────────────────────────────── */

export function SpendSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="sk h-3.5 w-3.5 rounded" />
        <span className="eyebrow">Agent Compute · 7d</span>
        <div className="sk h-3 w-20 ml-auto rounded" />
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Total tokens · 7d</div>
          <div className="sk h-[40px] w-52 rounded" />
          <div className="sk h-9 w-full rounded mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Models</div>
            <div className="sk h-5 w-12 rounded" />
          </div>
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Top model</div>
            <div className="sk h-5 w-24 rounded" />
          </div>
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="sk h-3 w-20 rounded shrink-0" />
              <SkBar w={`w-[${Math.max(20, 100 - i * 12)}%]`} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="sk h-1 flex-1 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 5. OmniSkeleton ───────────────────────────────────── */

export function OmniSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="sk h-3.5 w-3.5 rounded" />
        <span className="eyebrow">OmniRoute Compute · 7d</span>
        <div className="sk h-3 w-20 ml-auto rounded" />
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Total tokens · 7d</div>
          <div className="sk h-[40px] w-52 rounded" />
          <div className="sk h-9 w-full rounded mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Calls</div>
            <div className="sk h-5 w-16 rounded" />
          </div>
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Models</div>
            <div className="sk h-5 w-12 rounded" />
          </div>
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="sk h-3 w-20 rounded shrink-0" />
              <SkBar w={`w-[${Math.max(20, 100 - i * 12)}%]`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 6. FreeLLMSkeleton ────────────────────────────────── */

export function FreeLLMSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="sk h-3.5 w-3.5 rounded" />
        <span className="eyebrow">FreeLLM Compute · 7d</span>
        <div className="sk h-3 w-20 ml-auto rounded" />
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Total tokens · 7d</div>
          <div className="sk h-[40px] w-48 rounded" />
          <div className="sk h-9 w-full rounded mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Requests</div>
            <div className="sk h-5 w-16 rounded" />
          </div>
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Success rate</div>
            <div className="sk h-5 w-20 rounded" />
          </div>
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="sk h-3 w-20 rounded shrink-0" />
              <SkBar w={`w-[${Math.max(20, 100 - i * 12)}%]`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 7. YouTubeSkeleton ────────────────────────────────── */

export function YouTubeSkeleton() {
  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 p-2 border-b border-[var(--hq-hairline)]">
        <span className="eyebrow ml-2 mr-1" style={{ color: "#f87171" }}>YouTube</span>
        <div className="sk h-6 w-24 rounded-md" />
        <div className="sk h-6 w-20 rounded-md ml-1" />
      </div>
      <div className="p-4 space-y-4">
        <div className="sk aspect-video w-full rounded" />
        <div className="space-y-2">
          <SkBar w="w-3/4 h-4" />
          <SkBar w="w-1/3 h-3" />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div>
            <div className="sk h-3 w-12 rounded mb-1" />
            <div className="sk h-4 w-16 rounded" />
          </div>
          <div>
            <div className="sk h-3 w-12 rounded mb-1" />
            <div className="sk h-4 w-16 rounded" />
          </div>
          <div>
            <div className="sk h-3 w-12 rounded mb-1" />
            <div className="sk h-4 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 8. AgentsSkeleton ─────────────────────────────────── */

export function AgentsSkeleton() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="eyebrow mr-1">System</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--hq-hairline)] bg-white/[0.02] px-2.5 py-1.5"
        >
          <div className="sk h-1.5 w-1.5 rounded-full" />
          <div className="sk h-3 w-16 rounded" />
          <div className="sk h-2.5 w-10 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ── 9. KanbanSkeleton ─────────────────────────────────── */

export function KanbanSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <div className="sk h-4 w-24 rounded" />
          <div className="sk h-3 w-32 rounded" />
        </div>
        <div className="sk h-7 w-12 rounded" />
      </div>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="sk h-5 w-16 rounded-full" />
        ))}
      </div>
      <div className="space-y-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="py-2.5 border-b border-[var(--hq-hairline)] last:border-0">
            <div className="flex items-center gap-3">
              <div className="sk h-1.5 w-1.5 rounded-full shrink-0" />
              <div className="sk h-3 flex-1 rounded" />
              <div className="sk h-2.5 w-12 rounded shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 10. CryptoSkeleton ────────────────────────────────── */

export function CryptoSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base leading-none">🪙</span>
        <span className="eyebrow">Binance / Crypto</span>
        <div className="sk h-3 w-20 ml-auto rounded" />
        <div className="sk h-3 w-16 rounded" />
      </div>
      <div>
        <div className="eyebrow mb-2 !text-[9.5px]">Wallet value</div>
        <div className="sk h-[40px] w-44 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-4">
        <div>
          <div className="eyebrow mb-1.5 !text-[9.5px]">Today&apos;s PnL</div>
          <div className="sk h-5 w-24 rounded" />
        </div>
        <div>
          <div className="eyebrow mb-1.5 !text-[9.5px]">Since tracking</div>
          <div className="sk h-5 w-24 rounded" />
        </div>
      </div>
      <div className="mt-4">
        <div className="sk h-9 w-full rounded" />
      </div>
      <div className="mt-5 pt-4 border-t border-[var(--hq-hairline)] space-y-2.5">
        <div className="sk h-3 w-28 rounded mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="sk h-3 w-20 rounded shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="sk h-full rounded-full" style={{ width: `${Math.max(10, 80 - i * 15)}%` }} />
            </div>
            <div className="sk h-3 w-20 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 11. SageSkeleton ──────────────────────────────────── */

export function SageSkeleton() {
  return (
    <div className="panel flex flex-col p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base leading-none">🌿</span>
        <span className="eyebrow">Sage · Research Findings</span>
        <div className="sk h-3 w-20 ml-auto rounded" />
      </div>
      {(["AI Models & Market", "Cybersecurity & Threats"] as const).map((group) => (
        <div key={group} className="mb-5 last:mb-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="sk h-2.5 w-2.5 rounded-full" />
            <span className="eyebrow">{group}</span>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-[var(--hq-hairline)] p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="sk h-3 w-3 rounded shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <SkBar w="w-3/4 h-3.5" />
                    <SkBar w="w-full h-3" />
                    <SkBar w="w-5/6 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 12-14. Bar-list skeletons (reusable) ─────────────── */

function BarListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="mt-4 space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="sk h-3 w-20 rounded shrink-0" />
          <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="sk h-full rounded-full" style={{ width: `${Math.max(15, 100 - i * 13)}%` }} />
          </div>
          <div className="sk h-3 w-12 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function FreeLLMShareBarsSkeleton() {
  return <BarListSkeleton rows={7} />;
}

export function ModelShareBarsSkeleton() {
  return <BarListSkeleton rows={7} />;
}

export function OmniShareBarsSkeleton() {
  return <BarListSkeleton rows={7} />;
}

/* ── 15. TokenIOSplitSkeleton ──────────────────────────── */

export function TokenIOSplitSkeleton() {
  return (
    <div className="mt-auto pt-3">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
        <div className="sk h-full" style={{ width: "15%" }} />
        <div className="sk h-full" style={{ width: "40%" }} />
        <div className="sk h-full" style={{ width: "45%" }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] num text-[var(--hq-text-ghost)]">
        <div className="sk h-3 w-10 rounded" />
        <div className="sk h-3 w-10 rounded" />
        <div className="sk h-3 w-10 rounded" />
      </div>
    </div>
  );
}

/* ── Import map for page.tsx ───────────────────────────── */
/*
 * Replace in src/app/page.tsx:
 *   import { DiagnosticsStrip } from "@/components/diagnostics-strip";
 *   + import {
 *       IdeasSkeleton, TweetsSkeleton, XAnalyticsSkeleton,
 *       SpendSkeleton, OmniSkeleton, FreeLLMSkeleton,
 *       YouTubeSkeleton, AgentsSkeleton, KanbanSkeleton,
 *       CryptoSkeleton, SageSkeleton,
 *       FreeLLMShareBarsSkeleton, ModelShareBarsSkeleton, OmniShareBarsSkeleton,
 *       TokenIOSplitSkeleton,
 *     } from "@/components/dashboard/panel-skeletons";
 *
 * Delete: function PanelSkeleton(...) { ... }
 *
 * Swap call sites:
 *   IdeasPanel         → <IdeasSkeleton />
 *   TopTweetsPanel     → <TweetsSkeleton />
 *   XAnalyticsPanel    → <XAnalyticsSkeleton />
 *   SpendPanel         → <SpendSkeleton />
 *   OmniRoutePanel     → <OmniSkeleton />
 *   FreeLLMSpendPanel  → <FreeLLMSkeleton />
 *   YouTubeVideoTabs   → <YouTubeSkeleton />
 *   AgentsStrip        → <AgentsSkeleton />
 *   HermesKanbanPanel  → <KanbanSkeleton />
 *   CryptoPortfolioCard → <CryptoSkeleton />
 *   SageFindingsPanel  → <SageSkeleton />
 *   FreeLLMShareBars   → <FreeLLMShareBarsSkeleton />
 *   ModelShareBars     → <ModelShareBarsSkeleton />
 *   OmniShareBars      → <OmniShareBarsSkeleton />
 *   TokenIOSplit       → <TokenIOSplitSkeleton />
 */
