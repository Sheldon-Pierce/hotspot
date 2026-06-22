import "server-only";
import { and, or, eq, ne, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendship, profile } from "@/lib/db/schema";
import type { Profile } from "@/lib/profile/queries";

async function profilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  return db.select().from(profile).where(inArray(profile.userId, ids));
}

/** User ids of accepted friends (both directions). */
export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendship.requesterId, addresseeId: friendship.addresseeId })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId)),
      ),
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function getFriends(userId: string): Promise<Profile[]> {
  return profilesByIds(await getFriendIds(userId));
}

export async function getIncomingRequests(userId: string): Promise<Profile[]> {
  const rows = await db
    .select({ requesterId: friendship.requesterId })
    .from(friendship)
    .where(and(eq(friendship.status, "pending"), eq(friendship.addresseeId, userId)));
  return profilesByIds(rows.map((r) => r.requesterId));
}

export async function getOutgoingRequests(userId: string): Promise<Profile[]> {
  const rows = await db
    .select({ addresseeId: friendship.addresseeId })
    .from(friendship)
    .where(and(eq(friendship.status, "pending"), eq(friendship.requesterId, userId)));
  return profilesByIds(rows.map((r) => r.addresseeId));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ requesterId: friendship.requesterId })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(
          and(eq(friendship.requesterId, a), eq(friendship.addresseeId, b)),
          and(eq(friendship.requesterId, b), eq(friendship.addresseeId, a)),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function searchUsers(query: string, excludeUserId: string): Promise<Profile[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  const like = `%${q}%`;
  return db
    .select()
    .from(profile)
    .where(
      and(
        ne(profile.userId, excludeUserId),
        or(ilike(profile.username, like), ilike(profile.displayName, like)),
      ),
    )
    .limit(20);
}
