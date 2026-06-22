import "server-only";
import { eq, count, countDistinct } from "drizzle-orm";
import { db } from "@/lib/db";
import { profile, favorite, userBadge, checkin } from "@/lib/db/schema";
import { BADGES, type BadgeDef } from "@/lib/gamification/badges";

export type Profile = typeof profile.$inferSelect;

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const rows = await db.select().from(profile).where(eq(profile.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function getFavoriteBarIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ barId: favorite.barId })
    .from(favorite)
    .where(eq(favorite.userId, userId));
  return rows.map((r) => r.barId);
}

export async function getEarnedBadges(userId: string): Promise<BadgeDef[]> {
  const rows = await db
    .select({ key: userBadge.badgeKey })
    .from(userBadge)
    .where(eq(userBadge.userId, userId));
  const earned = new Set(rows.map((r) => r.key));
  return BADGES.filter((b) => earned.has(b.key));
}

export async function getCheckinSummary(
  userId: string,
): Promise<{ totalCheckins: number; distinctBars: number }> {
  const [total, distinct] = await Promise.all([
    db.select({ n: count() }).from(checkin).where(eq(checkin.userId, userId)),
    db.select({ n: countDistinct(checkin.barId) }).from(checkin).where(eq(checkin.userId, userId)),
  ]);
  return {
    totalCheckins: Number(total[0]?.n ?? 0),
    distinctBars: Number(distinct[0]?.n ?? 0),
  };
}
