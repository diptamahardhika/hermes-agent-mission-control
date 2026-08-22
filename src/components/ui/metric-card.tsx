"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Sparkline } from "@/components/sparkline";

// ── Reduced-motion-aware count-up ─────────────────────────
function useCountUp(target: number, duration = 1400, enabled = true) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || target === 0 || reduce) { setVal(target); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(target * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, enabled]);
  return val;
}

const UP = "#34d399";
const DOWN = "#fb7185";
const GHOST = "#52525b";

export interface MetricCardProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  delta?: number | null;
  deltaPct?: number | null;
  deltaLabel?: string;
  trend?: number[];
  goal?: number;
  goalFormat?: (n: number) => string;
  icon?: React.ReactNode;
  accent?: string;
  href?: string;
  loaded?: boolean;
  className?: string;
  fill?: boolean;
  /** Optional mini-visualizations rendered below the big value. */
  children?: React.ReactNode;
}

export function MetricCard({
  label, value, format = (n) => n.toLocaleString("en-US"),
  delta = null, deltaPct = null, deltaLabel, trend, goal, goalFormat,
  icon, accent = "#a1a1aa", href, loaded = true, className = "", fill = true,
  children,
}: MetricCardProps) {
  const counted = useCountUp(value, 1600, loaded);

  const hasDelta = delta !== null && delta !== undefined;
  const up = hasDelta && (delta as number) > 0;
  const down = hasDelta && (delta as number) < 0;
  const deltaColor = up ? UP : down ? DOWN : GHOST;
  const DeltaIcon = down ? ArrowDownRight : ArrowUpRight;

  const series = trend && trend.length >= 2 ? trend : null;
  const pct = goal && goal > 0 ? Math.min((value / goal) * 100, 100) : null;

  const inner = (
    <div className={`panel panel-interactive flex flex-col p-6 ${fill ? "h-full" : ""} ${className}`}>
      {/* label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: accent }} className="shrink-0 opacity-80">{icon}</span>
          <span className="eyebrow truncate">{label}</span>
        </div>
        {hasDelta && (
          <span
            className="flex items-center gap-0.5 text-[12.5px] font-semibold num"
            style={{ color: deltaColor }}
          >
            <DeltaIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
            {deltaPct !== null && deltaPct !== undefined
              ? `${Math.abs(deltaPct).toFixed(Math.abs(deltaPct) < 10 && deltaPct !== 0 ? 1 : 0)}%`
              : format(Math.abs(delta as number))}
          </span>
        )}
      </div>

      {/* value — big quiet number */}
      <div className="mt-5 num font-semibold leading-[0.95] tracking-[-0.02em] text-[52px] text-[var(--hq-text)]">
        {format(counted)}
      </div>

      {/* custom mini-viz slot */}
      {children}

      {/* sparkline */}
      {series && (
        <div className="mt-4">
          <Sparkline data={series} color={deltaColor} area idSeed={label} className="h-9" />
        </div>
      )}

      {/* target progress — pinned to bottom for row alignment */}
      {pct !== null && (
        <div className="mt-auto pt-4 space-y-1.5">
          <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-[1200ms] ease-out"
              style={{ width: loaded ? `${pct}%` : "0%", background: accent, opacity: 0.85 }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] num text-[var(--hq-text-ghost)]">
            <span style={{ color: accent }} className="opacity-90">{pct.toFixed(1)}%</span>
            <span>{deltaLabel ? `${deltaLabel} · ` : ""}goal {(goalFormat ?? format)(goal as number)}</span>
          </div>
        </div>
      )}

      {pct === null && deltaLabel && (
        <div className="mt-auto pt-3 text-[11px] num text-[var(--hq-text-ghost)]">{deltaLabel}</div>
      )}
    </div>
  );

  return href ? <a href={href} className={`block ${fill ? "h-full" : ""}`}>{inner}</a> : inner;
}
