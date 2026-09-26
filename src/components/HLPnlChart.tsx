"use client";

import { useState, useRef } from "react";

interface ChartPoint {
  label: string;
  balance: number;
  idx: number;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function HLPnlChart({
  chartData,
  totalPnl,
  totalTrades,
  walletBalance,
}: {
  chartData: ChartPoint[];
  chartMin: number;
  chartMax: number;
  totalPnl: number;
  totalTrades: number;
  walletBalance: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 28, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (!chartData || chartData.length < 2) return null;

  const balances = chartData.map(d => d.balance);
  const minB = Math.min(...balances);
  const maxB = Math.max(...balances);
  const pad = (maxB - minB) * 0.1 || 5;
  const domainMin = minB - pad;
  const domainMax = maxB + pad;
  const range = domainMax - domainMin;

  const toX = (i: number) => PAD.left + (i / (chartData.length - 1)) * innerW;
  const toY = (b: number) => PAD.top + innerH - ((b - domainMin) / range) * innerH;

  const linePts = chartData.map((d, i) => `${toX(i)},${toY(d.balance)}`).join(" ");
  const areaPath = `M ${toX(0)},${PAD.top + innerH} L ${linePts.replace(/,/g, " L ").split(" L").join(" L")} L ${toX(chartData.length - 1)},${PAD.top + innerH} Z`;

  const lineColor = totalPnl >= 0 ? "#a78bfa" : "#f87171";
  const areaColor = totalPnl >= 0 ? "#a78bfa" : "#f87171";

  // Y ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => domainMin + (range / 4) * i);

  // X labels: evenly spaced, max 4
  const xLabelIdxs = chartData.length <= 4
    ? chartData.map((_, i) => i)
    : [0, Math.floor(chartData.length / 3), Math.floor((2 * chartData.length) / 3), chartData.length - 1];

  // Ref line at $50
  const refY = toY(50);
  const showRef = refY >= PAD.top && refY <= PAD.top + innerH;

  // Hover handling
  // Plain function, not useCallback: this sits below the early `return null` above,
  // so a useCallback here would be called conditionally and break the Rules of
  // Hooks whenever chartData drops below 2 points. It only feeds an inline
  // onMouseMove, so it gains nothing from memoization.
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const chartX = mouseX - PAD.left;
    const ratio = Math.max(0, Math.min(1, chartX / innerW));
    const idx = Math.round(ratio * (chartData.length - 1));
    setHoverIdx(idx);
  };

  const hovered = hoverIdx !== null ? chartData[hoverIdx] : null;
  const hoveredDelta = hovered ? hovered.balance - 50 : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">Portfolio History</p>
        <div className="flex items-center gap-3">
          {hovered ? (
            <span className="text-xs text-neutral-400 font-mono">{hovered.label}</span>
          ) : null}
          <span className={`text-sm font-mono font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {hovered
              ? `$${fmt(hovered.balance)} (${hoveredDelta >= 0 ? "+" : ""}$${fmt(hoveredDelta)})`
              : `${totalPnl >= 0 ? "+" : ""}$${fmt(totalPnl)} total`}
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ height: 180 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={areaColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={toY(v)} x2={PAD.left + innerW} y2={toY(v)} stroke="#1a1a1a" strokeWidth="1" />
            <text x={PAD.left - 6} y={toY(v) + 3.5} textAnchor="end" fill="#3a3a3a" fontSize="9">
              ${Math.round(v)}
            </text>
          </g>
        ))}

        {/* $50 ref line */}
        {showRef && (
          <>
            <line x1={PAD.left} y1={refY} x2={PAD.left + innerW} y2={refY} stroke="#333" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PAD.left - 6} y={refY + 3.5} textAnchor="end" fill="#444" fontSize="8">$50</text>
          </>
        )}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* X axis labels */}
        {xLabelIdxs.map(i => (
          <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fill="#3a3a3a" fontSize="9">
            {chartData[i].label}
          </text>
        ))}

        {/* Hover crosshair */}
        {hoverIdx !== null && (
          <>
            <line
              x1={toX(hoverIdx)} y1={PAD.top}
              x2={toX(hoverIdx)} y2={PAD.top + innerH}
              stroke="#444" strokeWidth="1" strokeDasharray="3 2"
            />
            <circle
              cx={toX(hoverIdx)}
              cy={toY(chartData[hoverIdx].balance)}
              r="4" fill={lineColor} stroke="#111" strokeWidth="2"
            />
          </>
        )}

        {/* End dot */}
        {hoverIdx === null && (
          <circle
            cx={toX(chartData.length - 1)}
            cy={toY(chartData[chartData.length - 1].balance)}
            r="3.5" fill={lineColor} stroke="#111" strokeWidth="1.5"
          />
        )}
      </svg>

      <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-700">
        <span>Started $50</span>
        <span>{totalTrades} closed trades</span>
        <span className={totalPnl >= 0 ? "text-emerald-700" : "text-red-700"}>${fmt(walletBalance)} now</span>
      </div>
    </div>
  );
}
