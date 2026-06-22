import { describe, it, expect } from "vitest";
import { avatarColor, initials } from "@/lib/profile/avatar";

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("sheldon")).toBe(avatarColor("sheldon"));
  });
  it("returns an hsl() string", () => {
    expect(avatarColor("sheldon")).toMatch(/^hsl\(/);
  });
});

describe("initials", () => {
  it("takes first+last initials of a two-word name", () => {
    expect(initials("Sheldon Pierce")).toBe("SP");
  });
  it("takes first two letters of a single word", () => {
    expect(initials("madonna")).toBe("MA");
  });
  it("returns ? for empty input", () => {
    expect(initials("   ")).toBe("?");
  });
});
