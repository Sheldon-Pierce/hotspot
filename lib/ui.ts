import type { CrowdLevel, Trend } from "@/lib/types";

/** Single source of truth for crowd-level colors and labels (list + map). */
export const LEVEL_META: Record<
  CrowdLevel,
  { label: string; color: string; description: string }
> = {
  closed: { label: "Closed", color: "#6b7185", description: "Come back later" },
  quiet: { label: "Quiet", color: "#22d3ee", description: "Deals likely active" },
  warming: { label: "Warming up", color: "#5eead4", description: "Good time to grab a seat" },
  buzzing: { label: "Buzzing", color: "#fbbf24", description: "Lively crowd" },
  packed: { label: "Packed", color: "#ff2d78", description: "Expect a wait" },
};

export const TREND_META: Record<Trend, { icon: string; label: string }> = {
  rising: { icon: "↑", label: "Filling up" },
  falling: { icon: "↓", label: "Emptying out" },
  steady: { icon: "→", label: "Holding steady" },
};
