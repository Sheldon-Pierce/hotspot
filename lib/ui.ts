import type { CrowdLevel, Trend } from "@/lib/types";

/** Single source of truth for crowd-level colors and labels (list + map). */
export const LEVEL_META: Record<
  CrowdLevel,
  { label: string; color: string; description: string }
> = {
  closed: { label: "Closed", color: "#52525b", description: "Come back later" },
  quiet: { label: "Quiet", color: "#34d399", description: "Deals likely active" },
  warming: { label: "Warming up", color: "#facc15", description: "Good time to grab a seat" },
  buzzing: { label: "Buzzing", color: "#fb923c", description: "Lively crowd" },
  packed: { label: "Packed", color: "#f87171", description: "Expect a wait" },
};

export const TREND_META: Record<Trend, { icon: string; label: string }> = {
  rising: { icon: "↑", label: "Filling up" },
  falling: { icon: "↓", label: "Emptying out" },
  steady: { icon: "→", label: "Holding steady" },
};
