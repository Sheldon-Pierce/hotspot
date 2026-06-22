import { describe, it, expect } from "vitest";
import { LEVEL_META } from "@/lib/ui";

describe("LEVEL_META neon heat colors", () => {
  it("maps quiet→cyan and packed→magenta", () => {
    expect(LEVEL_META.quiet.color.toLowerCase()).toBe("#22d3ee");
    expect(LEVEL_META.packed.color.toLowerCase()).toBe("#ff2d78");
  });
  it("keeps all five levels", () => {
    for (const k of ["closed", "quiet", "warming", "buzzing", "packed"] as const) {
      expect(LEVEL_META[k].color).toMatch(/^#/);
    }
  });
});
