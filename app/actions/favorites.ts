"use server";

import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { favorite } from "@/lib/db/schema";
import { isValidBarId } from "@/lib/favorites";

export async function toggleFavorite(barId: string): Promise<{ favorited: boolean }> {
  const session = await requireSession();
  if (!isValidBarId(barId)) throw new Error("Unknown bar");

  const where = and(eq(favorite.userId, session.user.id), eq(favorite.barId, barId));
  const existing = await db.select({ barId: favorite.barId }).from(favorite).where(where).limit(1);

  if (existing.length > 0) {
    await db.delete(favorite).where(where);
    return { favorited: false };
  }
  // onConflictDoNothing: a concurrent double-submit can't throw a spurious 23505.
  await db.insert(favorite).values({ userId: session.user.id, barId }).onConflictDoNothing();
  return { favorited: true };
}
