import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pointsLedger, profile } from "@/lib/db/schema";
import { getFriendIds } from "@/lib/friends/queries";
import {
  windowStart,
  type LeaderboardScope,
  type LeaderboardWindow,
  type LeaderboardRow,
} from "@/lib/leaderboard/window";

export async function getLeaderboard(
  scope: LeaderboardScope,
  window: LeaderboardWindow,
  viewerId: string,
  now: Date,
): Promise<LeaderboardRow[]> {
  const start = windowStart(window, now);
  const conditions = [];
  if (start) conditions.push(gte(pointsLedger.createdAt, start));
  if (scope === "friends") {
    const ids = [viewerId, ...(await getFriendIds(viewerId))];
    conditions.push(inArray(pointsLedger.userId, ids));
  }

  const pts = sql<number>`sum(${pointsLedger.amount})`;
  const rows = await db
    .select({
      userId: pointsLedger.userId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      points: pts.mapWith(Number),
    })
    .from(pointsLedger)
    .innerJoin(profile, eq(pointsLedger.userId, profile.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(pointsLedger.userId, profile.username, profile.displayName, profile.avatarUrl)
    .orderBy(desc(pts))
    .limit(50);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
