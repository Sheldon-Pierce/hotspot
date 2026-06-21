"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";
import { usernameSchema } from "@/lib/profile/username";

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

  const taken = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.username, username))
    .limit(1);
  if (taken.length > 0) return { error: "That username is taken." };

  await db.insert(profile).values({
    userId: session.user.id,
    username,
    displayName,
  });

  redirect("/profile");
}
