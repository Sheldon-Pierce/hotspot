import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

/** Returns the Better Auth session or null. Memoized per render pass. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Secure check: redirects to /login if unauthenticated. */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return session;
}

/** Current user's profile row, or null if onboarding is incomplete. */
export const getCurrentProfile = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const rows = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, session.user.id))
    .limit(1);
  return rows[0] ?? null;
});
