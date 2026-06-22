interface SparklineProps {
  points: { t: string; count: number }[];
  max: number;
  color: string;
}

/** Tiny inline SVG chart of the last few hours of headcounts. */
export default function Sparkline({ points, max, color }: SparklineProps) {
  if (points.length < 2) return null;
  const w = 160;
  const h = 36;
  const step = w / (points.length - 1);
  const y = (count: number) => h - 2 - (count / Math.max(1, max)) * (h - 4);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p.count).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      aria-label="Crowd over the last 3 hours"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
