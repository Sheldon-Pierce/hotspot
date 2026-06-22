import "server-only";
import { and, count, countDistinct, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkin, pointsLedger, profile, userBadge } from "@/lib/db/schema";
import { isValidBarId } from "@/lib/favorites";
import { BADGES, type BadgeDef } from "@/lib/gamification/badges";
import {
  checkinPoints, evaluateBadges, isNightOwlHour, isWithinCooldown, levelForPoints,
} from "@/lib/gamification/engine";

export type CheckInResult =
  | { status: "ok"; pointsEarned: number; totalPoints: number; level: number; newBadges: BadgeDef[] }
  | { status: "cooldown" }
  | { status: "error"; message: string };

/** Local (Pacific) hour for the Night Owl check; bars are in Ballard. */
function pacificHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return Number(h) % 24;
}

/**
 * Core check-in: cooldown -> insert -> ledger -> bump profile points ->
 * evaluate & award badges, atomically. Takes an explicit userId/now so it is
 * testable without a request context; the server action supplies the session
 * userId and the current time.
 */
export async function recordCheckIn(
  userId: string,
  barId: string,
  now: Date,
): Promise<CheckInResult> {
  if (!isValidBarId(barId)) return { status: "error", message: "Unknown bar." };

  // Must be onboarded (have a profile) to earn points. Guard BEFORE the
  // transaction so an authenticated-but-not-onboarded user writes nothing —
  // otherwise the profile points-bump matches 0 rows and we'd leave orphan
  // checkin/ledger/badge rows while reporting points that never persisted.
  const prof = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);
  if (prof.length === 0) {
    return { status: "error", message: "Finish setting up your profile first." };
  }

  return db.transaction(async (tx): Promise<CheckInResult> => {
    // Cooldown: most recent check-in at this bar.
    const last = await tx
      .select({ createdAt: checkin.createdAt })
      .from(checkin)
      .where(and(eq(checkin.userId, userId), eq(checkin.barId, barId)))
      .orderBy(desc(checkin.createdAt))
      .limit(1);
    if (isWithinCooldown(last[0]?.createdAt ?? null, now)) {
      return { status: "cooldown" };
    }

    // First-ever check-in at this bar?
    const priorAtBar = await tx
      .select({ n: count() })
      .from(checkin)
      .where(and(eq(checkin.userId, userId), eq(checkin.barId, barId)));
    const isNewBar = Number(priorAtBar[0]?.n ?? 0) === 0;

    // Insert the check-in, stamping the action's `now` so the recorded time
    // matches the clock the cooldown compares against.
    const checkinId = crypto.randomUUID();
    await tx.insert(checkin).values({ id: checkinId, userId, barId, createdAt: now });

    // Points ledger + denormalized total.
    const entries = checkinPoints(isNewBar);
    const pointsEarned = entries.reduce((sum, e) => sum + e.amount, 0);
    await tx.insert(pointsLedger).values(
      entries.map((e) => ({
        id: crypto.randomUUID(),
        userId,
        checkinId,
        reason: e.reason,
        amount: e.amount,
        createdAt: now, // same timestamp as the check-in (leaderboard windows)
      })),
    );
    const updated = await tx
      .update(profile)
      .set({ points: sql`${profile.points} + ${pointsEarned}` })
      .where(eq(profile.userId, userId))
      .returning({ points: profile.points });
    const totalPoints = updated[0]?.points ?? pointsEarned;

    // All-time #1 by total points → Neighborhood Champ (ties: all leaders earn it).
    // profile.points was bumped above in this same transaction, so the max reflects it.
    const maxRow = await tx.select({ max: sql<number>`max(${profile.points})` }).from(profile);
    const isNeighborhoodChamp = totalPoints > 0 && totalPoints >= Number(maxRow[0]?.max ?? 0);

    // Stats (including this check-in) for badge evaluation.
    const [totalRow, distinctRow, perBar] = await Promise.all([
      tx.select({ n: count() }).from(checkin).where(eq(checkin.userId, userId)),
      tx.select({ n: countDistinct(checkin.barId) }).from(checkin).where(eq(checkin.userId, userId)),
      tx
        .select({ barId: checkin.barId, n: count() })
        .from(checkin)
        .where(eq(checkin.userId, userId))
        .groupBy(checkin.barId),
    ]);
    const maxAtOneBar = perBar.reduce((m, r) => Math.max(m, Number(r.n)), 0);
    const earnedKeys = evaluateBadges({
      totalCheckins: Number(totalRow[0]?.n ?? 0),
      distinctBars: Number(distinctRow[0]?.n ?? 0),
      maxCheckinsAtOneBar: maxAtOneBar,
      isNightOwl: isNightOwlHour(pacificHour(now)),
      isNeighborhoodChamp,
    });

    // Award not-yet-earned badges; report only the newly earned ones.
    const before = await tx
      .select({ key: userBadge.badgeKey })
      .from(userBadge)
      .where(eq(userBadge.userId, userId));
    const had = new Set(before.map((r) => r.key));
    const fresh = earnedKeys.filter((k) => !had.has(k));
    if (fresh.length > 0) {
      await tx
        .insert(userBadge)
        .values(fresh.map((badgeKey) => ({ userId, badgeKey })))
        .onConflictDoNothing();
    }
    const newBadges: BadgeDef[] = BADGES.filter((b) => fresh.includes(b.key));

    return {
      status: "ok",
      pointsEarned,
      totalPoints,
      level: levelForPoints(totalPoints),
      newBadges,
    };
  });
}
