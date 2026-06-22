import { z } from "zod";

// Empty strings normalize to null; avatarUrl must be http(s) if provided.
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const profileEditSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(50),
  bio: z.preprocess(emptyToNull, z.string().trim().max(280).nullable()),
  avatarUrl: z.preprocess(
    emptyToNull,
    z
      .url("Avatar URL must be a valid URL.")
      .max(2048, "Avatar URL is too long.")
      .refine((u) => /^https?:\/\//.test(u), "Avatar URL must start with http(s)://")
      .nullable(),
  ),
});

export type ProfileEdit = z.infer<typeof profileEditSchema>;
