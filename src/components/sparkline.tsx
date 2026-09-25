interface SparklineProps {
  data: number[];
  positive?: boolean;
  /** Explicit stroke color; overrides `positive`. */
  color?: string;
  /** Render a soft gradient area under the line. */
  area?: boolean;
  className?: string;
  /** A stable id seed so multiple sparklines don't share a gradient def. */
  idSeed?: string;
  /** Accessible label for screen readers. */
  "aria-label"?: string;
}

export function Sparkline({ data, positive = true, color, area = false, className = "", idSeed = "", "aria-label": ariaLabel }: SparklineProps) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  const coords = data.map((value, index) => {
    const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
    // pad vertically so the line never hugs the very edge
    const y = range === 0 ? 50 : 92 - ((value - min) / range) * 84;
    return { x, y };
  });

  const points = coords.map(c => `${c.x},${c.y}`).join(" ");
  const strokeColor = color ?? (positive ? "#10b981" : "#ef4444");
  const gid = `spark-${idSeed || strokeColor.replace("#", "")}-${data.length}`;

  const areaPath = area
    ? `M ${coords[0].x},100 L ${coords.map(c => `${c.x},${c.y}`).join(" L ")} L ${coords[coords.length - 1].x},100 Z`
    : null;

  const last = coords[coords.length - 1];

  return (
    <div
      className={`relative w-full h-10 ${className}`}
      role="img"
      aria-label={ariaLabel ?? "Data trend"}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible" aria-hidden="true">
        {area && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {areaPath && <path d={areaPath} fill={`url(#${gid})`} stroke="none" />}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* emphasized endpoint dot — overlaid so it stays a true circle */}
      <span
        className="absolute rounded-full"
        style={{
          left: `${last.x}%`,
          top: `${last.y}%`,
          width: 6,
          height: 6,
          transform: "translate(-50%, -50%)",
          background: strokeColor,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${strokeColor} 20%, transparent)`,
        }}
      />
    </div>
  );
}
