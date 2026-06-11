import type { Bar, Deal } from "@/lib/types";
import type { LocalTime } from "@/lib/simulation";

/**
 * Deal engine. Two kinds of deals:
 *
 * 1. Incentive deals — the core hook of the app. When an open bar drops
 *    below INCENTIVE_THRESHOLD of capacity, its incentive activates
 *    ("Free jello shots until we hit 60 people!") and expires on its own
 *    once the crowd recovers past the target.
 * 2. Happy hours — static scheduled windows from seed data.
 */

/** Below this share of capacity, a quiet bar starts giving things away. */
export const INCENTIVE_THRESHOLD = 0.35;

/** The incentive runs until the crowd reaches this share of capacity. */
export const INCENTIVE_TARGET = 0.5;

export interface DealContext {
  open: boolean;
  ratio: number;
  time: LocalTime;
}

export function incentiveDeal(bar: Bar, ctx: DealContext): Deal | null {
  if (!ctx.open || ctx.ratio >= INCENTIVE_THRESHOLD) return null;
  const target = Math.ceil(bar.capacity * INCENTIVE_TARGET);
  return {
    barId: bar.id,
    type: "incentive",
    title: bar.incentive,
    description: `${bar.incentive} until we hit ${target} people — come fill the room!`,
  };
}

export function happyHourDeal(bar: Bar, ctx: DealContext): Deal | null {
  const hh = bar.happyHour;
  if (!hh || !ctx.open) return null;
  const { day, hour } = ctx.time;
  if (!hh.days.includes(day)) return null;
  if (hour < hh.startHour || hour >= hh.endHour) return null;
  return {
    barId: bar.id,
    type: "happy-hour",
    title: "Happy Hour",
    description: hh.description,
  };
}

export function activeDeals(bar: Bar, ctx: DealContext): Deal[] {
  return [incentiveDeal(bar, ctx), happyHourDeal(bar, ctx)].filter(
    (d): d is Deal => d !== null
  );
}
