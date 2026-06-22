import { describe, it, expect } from "vitest";
import { profileEditSchema } from "@/lib/profile/profile-input";

describe("profileEditSchema", () => {
  it("accepts a display name with empty bio and url (normalized to null)", () => {
    const r = profileEditSchema.safeParse({ displayName: "Sheldon", bio: "", avatarUrl: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bio).toBeNull();
      expect(r.data.avatarUrl).toBeNull();
    }
  });
  it("rejects an empty display name", () => {
    expect(profileEditSchema.safeParse({ displayName: "  ", bio: "", avatarUrl: "" }).success).toBe(false);
  });
  it("rejects a non-http avatar url", () => {
    expect(
      profileEditSchema.safeParse({ displayName: "S", bio: "", avatarUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
  it("accepts an https avatar url", () => {
    const r = profileEditSchema.safeParse({ displayName: "S", bio: "hi", avatarUrl: "https://x.com/a.png" });
    expect(r.success).toBe(true);
  });
});
