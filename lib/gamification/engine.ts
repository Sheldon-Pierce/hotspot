export const POINTS = { checkin: 10, newBar: 15 } as const;
export const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Source of truth for points_ledger.reason values (Team D filters on these). */
export type PointsReason = "checkin" | "new-bar";

export function checkinPoints(isNewBar: boolean): { amount: number; reason: PointsReason }[] {
  const entries: { amount: number; reason: PointsReason }[] = [
    { amount: POINTS.checkin, reason: "checkin" },
  ];
  if (isNewBar) entries.push({ amount: POINTS.newBar, reason: "new-bar" });
  return entries;
}

/** Level from total points: 1 at 0–49, then a gentle sqrt curve. */
export function levelForPoints(points: number): number {
  return Math.floor(Math.sqrt(Math.max(0, points) / 50)) + 1;
}

/** True if a prior check-in is recent enough to block scoring again. */
export function isWithinCooldown(lastAt: Date | null, now: Date): boolean {
  if (!lastAt) return false;
  return now.getTime() - lastAt.getTime() < COOLDOWN_MS;
}

/** Night Owl window: local hour in [0, 4). */
export function isNightOwlHour(hour: number): boolean {
  return hour >= 0 && hour < 4;
}

export interface BadgeStats {
  totalCheckins: number;
  distinctBars: number;
  maxCheckinsAtOneBar: number;
  isNightOwl: boolean;
  isNeighborhoodChamp: boolean;
}

/** Badge keys earned at these stats. Keys match lib/gamification/badges.ts. */
export function evaluateBadges(s: BadgeStats): string[] {
  const earned: string[] = [];
  if (s.totalCheckins >= 1) earned.push("first-round");
  if (s.distinctBars >= 5) earned.push("explorer-5");
  if (s.distinctBars >= 10) earned.push("explorer-10");
  if (s.maxCheckinsAtOneBar >= 10) earned.push("regular");
  if (s.isNightOwl) earned.push("night-owl");
  if (s.isNeighborhoodChamp) earned.push("neighborhood-champ");
  return earned;
}
