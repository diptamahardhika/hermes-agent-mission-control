"use client";

import { useMemo, useState } from "react";

interface Category {
  name: string;
  spent: number;
  budget: number;
  color: string;
}

export interface FunnelChartProps {
  categories: Category[];
}

const SRC_X = 8;
const SRC_W = 64;
const TGT_X = 320;
const TGT_W = 28;
const VIEW_W = 400;
const VIEW_H = 280;
const PAD_TOP = 28;
const PAD_BOT = 24;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMoney(n: number) {
  return `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FunnelChart({ categories }: FunnelChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const total = categories.reduce((s, c) => s + c.spent, 0);
  const maxBudget = Math.max(...categories.map((c) => c.budget), 1);

  // Map CSS variable strings to actual colors for SVG compatibility
  const resolveSvgColor = (colorVar: string): string => {
    const colorMap: Record<string, string> = {
      "var(--color-success)": "#5fd0a0",
      "var(--color-warning)": "#f5c451",
      "var(--color-info)": "#6ea8fe",
      "var(--color-danger)": "#f28b82",
      "var(--color-purple)": "#a855f7",
      "var(--color-pink)": "#ec4899",
    };
    return colorMap[colorVar] || colorVar;
  };

  const layout = useMemo(() => {
    const availH = VIEW_H - PAD_TOP - PAD_BOT;
    const scale = availH / total;

    // Source: centered vertically
    const srcH = Math.max(availH * 0.7, 40);
    const srcY = (VIEW_H - srcH) / 2;

    // Targets: stack proportionally, centered
    const tgtH = categories.map((c) => Math.max(c.spent * scale, 6));
    const tgtTotalH = tgtH.reduce((a, b) => a + b, 0);
    const tgtStartY = (VIEW_H - tgtTotalH) / 2;
    const tgtY = tgtH.reduce<number[]>((acc, h, i) => {
      const prev = i === 0 ? 0 : acc[i - 1] + tgtH[i - 1];
      return [...acc, tgtStartY + prev];
    }, []);

    return { srcX: SRC_X, srcY, srcW: SRC_W, srcH, tgtX: TGT_X, tgtW: TGT_W, tgtY, availH };
  }, [total, categories]);

  const { srcX, srcY, srcW, srcH, tgtX, tgtW, tgtY } = layout;

  return (
    <div className="mt-2 select-none">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto max-h-[260px]"
        role="img"
        aria-label="Spending sankey diagram"
      >
        {/* Source node */}
        <rect
          x={srcX}
          y={srcY}
          width={srcW}
          height={srcH}
          rx={4}
          fill="var(--surface-2)"
          stroke="var(--hq-text-dim)"
          strokeWidth={0.5}
          strokeOpacity={0.3}
        />
        <text
          x={srcX + srcW / 2}
          y={srcY + srcH / 2 - 6}
          textAnchor="middle"
          className="fill-[var(--hq-text-dim)] pointer-events-none"
          style={{ fontSize: 9, fontFamily: "Geist, sans-serif", fontWeight: 500, letterSpacing: "0.04em" }}
        >
          TOTAL
        </text>
        <text
          x={srcX + srcW / 2}
          y={srcY + srcH / 2 + 8}
          textAnchor="middle"
          className="fill-[var(--hq-text)] pointer-events-none"
          style={{ fontSize: 10, fontFamily: "Geist Mono, monospace", fontWeight: 600 }}
        >
          {fmtMoney(total)}
        </text>

        {/* Sankey bands */}
        {categories.map((cat, i) => {
          const spentPct = total > 0 ? (cat.spent / total) * 100 : 0;
          const overBudget = cat.budget > 0 && cat.spent > cat.budget;
          const bandTop = tgtY[i];
          const bandH = Math.max((cat.spent / total) * layout.availH, 6);
          const bandBot = bandTop + bandH;

          // Source Y position: distribute source height proportionally
          const srcBandH = Math.max((cat.spent / total) * srcH, 4);
          const srcCenter = srcY + srcH / 2;
          const srcBandCenter = srcCenter + (i - (categories.length - 1) / 2) * (srcH / Math.max(categories.length, 1));
          const sTop = Math.max(srcY, Math.min(srcY + srcH - srcBandH, srcBandCenter - srcBandH / 2));
          const sBot = Math.min(srcY + srcH, sTop + srcBandH);

          const x0 = srcX + srcW;
          const x1 = tgtX;
          const midX = (x0 + x1) / 2;

          const pathD = [
            `M ${x0} ${sTop}`,
            `C ${midX} ${sTop}, ${midX} ${bandTop}, ${x1} ${bandTop}`,
            `L ${x1} ${bandBot}`,
            `C ${midX} ${bandBot}, ${midX} ${sBot}, ${x0} ${sBot}`,
            `Z`,
          ].join(" ");

          // Determine band color
          let bandFill: string;
          let bandOpacity: number;
          if (overBudget) {
            bandFill = resolveSvgColor("var(--color-warning)");
            bandOpacity = 0.8;
          } else {
            bandFill = resolveSvgColor(cat.color);
            bandOpacity = hoverIdx === null || hoverIdx === i ? 0.85 : 0.15;
          }

          const isHovered = hoverIdx === i;
          const isDimmed = hoverIdx !== null && !isHovered;

          return (
            <g key={cat.name} style={{ opacity: isDimmed ? 0.2 : 1, transition: "opacity 180ms ease" }}>
              <path
                d={pathD}
                fill={bandFill}
                fillOpacity={bandOpacity}
                stroke="none"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
              {/* Subtle edge highlight on hover */}
              {isHovered && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="white"
                  strokeOpacity={0.12}
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}

        {/* Target nodes + labels */}
        {categories.map((cat, i) => {
          const spentPct = total > 0 ? (cat.spent / total) * 100 : 0;
          const overBudget = cat.budget > 0 && cat.spent > cat.budget;
          const bandH = Math.max((cat.spent / total) * layout.availH, 6);
          const by = tgtY[i];
          const isHovered = hoverIdx === i;

          return (
            <g key={`tgt-${i}`} style={{ opacity: hoverIdx !== null && !isHovered ? 0.3 : 1, transition: "opacity 180ms ease" }}>
              {/* Target bar */}
              <rect
                x={tgtX + tgtW}
                y={by}
                width={8}
                height={bandH}
                rx={2}
                fill={resolveSvgColor(cat.color)}
                opacity={0.85}
              />
              {/* Category name */}
              <text
                x={tgtX + tgtW + 14}
                y={by + bandH / 2 - 4}
                className="fill-[var(--hq-text-dim)] pointer-events-none"
                style={{ fontSize: 9.5, fontFamily: "Geist, sans-serif", fontWeight: 400 }}
              >
                {cat.name}
              </text>
              {/* Amount + % */}
              <text
                x={tgtX + tgtW + 14}
                y={by + bandH / 2 + 7}
                className="pointer-events-none"
                style={{
                  fontSize: 9.5,
                  fontFamily: "Geist Mono, monospace",
                  fontWeight: 600,
                  fill: overBudget ? "var(--color-danger)" : isHovered ? "var(--hq-text)" : "var(--hq-text)",
                }}
              >
                {fmtMoney(cat.spent)} {spentPct.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
