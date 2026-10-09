"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Reduced-motion-aware count-up ─────────────────────────
export function useCountUp(target: number, duration = 1400, enabled = true) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  // Preserve whatever precision the target has: a whole-number token count
  // should step by 1, but a currency value needs its cents to survive the
  // count or the card would render fabricated whole dollars mid-flight.
  const precision = useMemo(() => {
    if (!Number.isFinite(target)) return 0;
    const s = String(target);
    if (!s.includes(".")) return 0;
    return Math.min(s.split(".")[1].length, 6);
  }, [target]);
  useEffect(() => {
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || target === 0 || reduceMotion) {
      // Defer state update to avoid synchronous setState in effect
      const id = requestAnimationFrame(() => setVal(target));
      return () => cancelAnimationFrame(id);
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      const factor = 10 ** precision;
      setVal(Math.round(target * ease * factor) / factor);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, enabled, precision]);
  return val;
}

export interface CountUpProps {
  /** Target number to count toward. Renders nothing until non-null. */
  value: number | null | undefined;
  /** Formats the in-flight value for display. */
  format?: (n: number) => string;
  duration?: number;
  /** Gate the animation, e.g. until the socket data has arrived. */
  enabled?: boolean;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString("en-US");

/**
 * Counts a number up on mount, then holds the final value. Honours
 * `prefers-reduced-motion` by jumping straight to the target.
 *
 * Use this for the big headline numbers on cards so every card counts the
 * same way. Render a placeholder yourself when `value` is null/undefined —
 * this returns null in that case so you can show "—" or a skeleton instead.
 */
export function CountUp({
  value, format = defaultFormat, duration = 1600, enabled = true, className,
}: CountUpProps) {
  const counted = useCountUp(typeof value === "number" && Number.isFinite(value) ? value : 0, duration, enabled);
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return <span className={className}>{format(counted)}</span>;
}
