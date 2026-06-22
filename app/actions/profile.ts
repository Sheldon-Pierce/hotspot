"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";
import { usernameSchema } from "@/lib/profile/username";
import { profileEditSchema } from "@/lib/profile/profile-input";

const schema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Display name is required.").max(50),
});

export async function createProfile(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireSession();

  if (await getCurrentProfile()) redirect("/profile"); // already onboarded

  const parsed = schema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { username, displayName } = parsed.data;

  // Fast path: friendly message in the common case.
  const taken = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.username, username))
    .limit(1);
  if (taken.length > 0) return { error: "That username is taken." };

  // Authoritative guard: the unique index wins any concurrent race. Map the
  // resulting unique-violation to a friendly message instead of a raw 500.
  try {
    await db.insert(profile).values({
      userId: session.user.id,
      username,
      displayName,
    });
  } catch (e) {
    const constraint = uniqueViolation(e);
    if (constraint === null) throw e;
    // profile_pkey => this user already has a profile (concurrent double-submit).
    if (constraint === "profile_pkey") redirect("/profile");
    return { error: "That username is taken." };
  }

  redirect("/profile");
}

export async function updateProfile(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireSession();

  const parsed = profileEditSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    avatarUrl: formData.get("avatarUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db
    .update(profile)
    .set({
      displayName: parsed.data.displayName,
      bio: parsed.data.bio,
      avatarUrl: parsed.data.avatarUrl,
    })
    .where(eq(profile.userId, session.user.id));

  redirect("/profile");
}

/**
 * Returns the violated constraint name for a Postgres unique violation (23505),
 * else null. Drizzle wraps the driver error, so the PostgresError (with `.code`
 * and `.constraint_name`) is on `.cause`; check both to be safe.
 */
function uniqueViolation(e: unknown): string | null {
  const layers = [e, (e as { cause?: unknown } | null)?.cause];
  for (const layer of layers) {
    const err = layer as { code?: string; constraint_name?: string } | null | undefined;
    if (err?.code === "23505") return err.constraint_name ?? "";
  }
  return null;
}
