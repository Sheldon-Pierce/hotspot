export type LeaderboardScope = "friends" | "neighborhood";
export type LeaderboardWindow = "week" | "all";

export interface LeaderboardRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  rank: number;
}

/** Start of the window, or null for all-time. "week" is a rolling 7 days. */
export function windowStart(window: LeaderboardWindow, now: Date): Date | null {
  if (window === "all") return null;
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}
