"use client";

import { useState, useEffect } from "react";
import { Waypoints, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/sparkline";
import { CountUp } from "@/components/ui/count-up";
import { OmniSkeleton } from "@/components/dashboard/panel-skeletons";
import { fmt, fmtExact, timeAgo } from "@/lib/home-format";
import type { OmniSpendData } from "@/types/home-dashboard";

export default function OmniRoutePanel({ omni }: { omni: OmniSpendData }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);
  const series = omni.days.map(d => d.tokens);
  const topModel = [...omni.byModel].sort((a, b) => b.tokens - a.tokens)[0];
  const topCache = topModel?.cacheReadTokens ?? 0;
  const topCachePct = topModel && topModel.tokens ? Math.round((topCache / topModel.tokens) * 100) : 0;
  return (
    <div className="panel flex flex-col p-6">
      {loading && <OmniSkeleton />}
      <div className="flex items-center gap-2 mb-4">
        <Waypoints className="w-3.5 h-3.5" style={{ color: "#2dd4bf" }} />
        <span className="eyebrow">OmniRoute Compute · 7d</span>
        {omni.syncedAt && <span className="num ml-auto text-[10px] text-[var(--hq-text-ghost)]">synced {timeAgo(omni.syncedAt)}</span>}
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Total tokens · 7d</div>
          <div className="num font-semibold text-[40px] leading-[0.95] tracking-[-0.02em] text-[var(--hq-text)]">
            {omni.totalTokens != null
              ? <CountUp value={omni.totalTokens} format={fmtExact} />
              : "—"}
          </div>
          {series.some(v => v > 0) && <Sparkline data={series} color="#2dd4bf" area idSeed="omni-spend" className="h-9 mt-3" aria-label="OmniRoute tokens trend over 7 days" />}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Calls</div>
            <div className="num font-semibold text-[18px] text-[var(--hq-text)]">{fmtExact(omni.totalCalls)}</div>
          </div>
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Models</div>
            <div className="num font-semibold text-[18px] text-[var(--hq-text)]">{fmtExact(omni.byModel.length)}</div>
          </div>
        </div>
        {omni.cacheReadTokens > 0 && (
          <div className="text-[12px] text-[var(--hq-text-dim)]">
            Cached reads <span className="num text-[var(--hq-text)] font-medium">{fmt(omni.cacheReadTokens)}</span>
            <span className="num text-[var(--hq-text-ghost)]"> · {Math.round((omni.cacheReadTokens / (omni.totalTokens || 1)) * 100)}% of total</span>
          </div>
        )}
        {topModel && (
          <div className="text-[12px] text-[var(--hq-text-dim)]">
            Top model <span className="text-[var(--hq-text)] font-medium">{topModel.model}</span>
            <span className="num text-[var(--hq-text-ghost)]">
               · {fmt(topModel.tokens)} tok{topCache > 0 ? ` (${topCachePct}% cached)` : ""}
            </span>
          </div>
        )}
      </div>
      <a href="/api/omniroute/link" className="mt-auto pt-4 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
        Open OmniRoute analytics <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}
