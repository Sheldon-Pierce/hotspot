import type { CrowdLevel } from "@/lib/types";
import { LEVEL_META } from "@/lib/ui";

const GRADIENT: Record<CrowdLevel, string> = {
  closed: "var(--faint), var(--faint)",
  quiet: "var(--cyan), var(--green)",
  warming: "var(--cyan), var(--amber)",
  buzzing: "var(--cyan), var(--amber)",
  packed: "var(--amber), var(--magenta)",
};

/** The signature element: a glowing crowd bar colored by level. */
export default function HeatMeter({ ratio, level }: { ratio: number; level: CrowdLevel }) {
  const color = LEVEL_META[level].color;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[.07]">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${Math.min(100, Math.max(4, ratio * 100))}%`,
          backgroundImage: `linear-gradient(90deg, ${GRADIENT[level]})`,
          boxShadow: `0 0 14px ${color}`,
        }}
      />
    </div>
  );
}
