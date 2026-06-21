import { describe, it, expect } from "vitest";
import { usernameSchema, normalizeUsername } from "@/lib/profile/username";

describe("normalizeUsername", () => {
  it("lowercases and strips a leading @", () => {
    expect(normalizeUsername("@SheLDon")).toBe("sheldon");
  });
});

describe("usernameSchema", () => {
  it("accepts 3–20 chars of [a-z0-9_]", () => {
    expect(usernameSchema.safeParse("bar_hopper99").success).toBe(true);
  });
  it("normalizes before validating (accepts @Mixed_Case)", () => {
    const result = usernameSchema.safeParse("@Mixed_Case");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("mixed_case");
  });
  it("rejects too short", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });
  it("rejects too long", () => {
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
  });
  it("rejects illegal characters", () => {
    expect(usernameSchema.safeParse("has space").success).toBe(false);
  });
});
