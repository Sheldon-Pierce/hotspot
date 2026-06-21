import { describe, it, expect } from "vitest";
import { BADGES } from "@/lib/gamification/badges";

describe("BADGES catalog", () => {
  it("has unique keys", () => {
    const keys = BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("includes the starter set", () => {
    const keys = BADGES.map((b) => b.key);
    for (const k of [
      "first-round", "explorer-5", "regular", "night-owl", "neighborhood-champ",
    ]) {
      expect(keys).toContain(k);
    }
  });
  it("every badge has non-empty name, description, icon, criteria", () => {
    for (const b of BADGES) {
      expect(b.name.length, b.key).toBeGreaterThan(0);
      expect(b.description.length, b.key).toBeGreaterThan(0);
      expect(b.icon.length, b.key).toBeGreaterThan(0);
      expect(b.criteria.length, b.key).toBeGreaterThan(0);
    }
  });
});
