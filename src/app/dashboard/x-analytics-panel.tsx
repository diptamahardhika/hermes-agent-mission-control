"use client";

import { useState, useEffect } from "react";
import { Twitter, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/sparkline";
import { CountUp } from "@/components/ui/count-up";
import { XAnalyticsSkeleton } from "@/components/dashboard/panel-skeletons";
import { fmt, fmtExact } from "@/lib/home-format";

export default function XAnalyticsPanel({ views, trend, totalTweets, bestDay, bestHour }: {
  views: number; trend: number[]; totalTweets: number; bestDay: string; bestHour: string;
}) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);
  return (
    <div className="panel flex flex-col p-6">
      {loading && <XAnalyticsSkeleton />}
      <div className="flex items-center gap-2 mb-4">
        <Twitter className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
        <span className="eyebrow">X Analytics</span>
      </div>
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-2 !text-[9.5px]">Views · 7d</div>
          <div className="num font-semibold text-[40px] leading-[0.95] tracking-[-0.02em] text-[var(--hq-text)]"><CountUp value={views} format={fmt} /></div>
          {trend.some(v => v > 0) && <Sparkline data={trend} color="#38bdf8" area idSeed="xviews" className="h-9 mt-3" aria-label="X views trend over 7 days" />}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Tracked</div>
            <div className="num font-semibold text-[18px] text-[var(--hq-text)]">{fmtExact(totalTweets)}</div>
          </div>
          <div>
            <div className="eyebrow mb-1.5 !text-[9.5px]">Best window</div>
            <div className="text-[13px] font-medium text-[var(--hq-text-dim)]">{bestDay}<span className="num"> · {bestHour}</span></div>
          </div>
        </div>
      </div>
      <a href="/x" className="mt-auto pt-4 flex items-center gap-1 text-[var(--hq-text-faint)] text-[11px] font-medium hover:text-[var(--hq-text-dim)] transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
        Open X dashboard <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </div>
  );
}
