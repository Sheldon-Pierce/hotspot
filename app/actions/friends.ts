"use server";

import { and, or, eq } from "drizzle-orm";
import { requireSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { friendship, profile } from "@/lib/db/schema";

type SendStatus = "self" | "already-friends" | "already-requested" | "requested" | "accepted" | "error";

export async function sendFriendRequest(targetUserId: string): Promise<{ status: SendStatus }> {
  const session = await requireSession();
  const me = session.user.id;
  if (me === targetUserId) return { status: "self" };

  const target = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.userId, targetUserId))
    .limit(1);
  if (target.length === 0) return { status: "error" };

  const existing = await db
    .select({
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      status: friendship.status,
    })
    .from(friendship)
    .where(
      or(
        and(eq(friendship.requesterId, me), eq(friendship.addresseeId, targetUserId)),
        and(eq(friendship.requesterId, targetUserId), eq(friendship.addresseeId, me)),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.status === "accepted") return { status: "already-friends" };
    if (row.requesterId === me) return { status: "already-requested" };
    // Reverse pending request exists — accept it (mutual intent).
    await db
      .update(friendship)
      .set({ status: "accepted" })
      .where(and(eq(friendship.requesterId, targetUserId), eq(friendship.addresseeId, me)));
    return { status: "accepted" };
  }

  await db
    .insert(friendship)
    .values({ requesterId: me, addresseeId: targetUserId, status: "pending" })
    .onConflictDoNothing();
  return { status: "requested" };
}

export async function respondToRequest(
  requesterId: string,
  action: "accept" | "decline",
): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const me = session.user.id;
  const where = and(
    eq(friendship.requesterId, requesterId),
    eq(friendship.addresseeId, me),
    eq(friendship.status, "pending"),
  );
  if (action === "accept") {
    await db.update(friendship).set({ status: "accepted" }).where(where);
  } else {
    await db.delete(friendship).where(where);
  }
  return { ok: true };
}

export async function removeFriend(otherUserId: string): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const me = session.user.id;
  await db
    .delete(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(
          and(eq(friendship.requesterId, me), eq(friendship.addresseeId, otherUserId)),
          and(eq(friendship.requesterId, otherUserId), eq(friendship.addresseeId, me)),
        ),
      ),
    );
  return { ok: true };
}
