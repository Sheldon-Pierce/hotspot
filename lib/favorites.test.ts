import { describe, it, expect } from "vitest";
import { isValidBarId, barName } from "@/lib/favorites";
import { BARS } from "@/data/bars";

describe("isValidBarId", () => {
  it("accepts a real seed bar id", () => {
    expect(isValidBarId(BARS[0].id)).toBe(true);
  });
  it("rejects an unknown id", () => {
    expect(isValidBarId("not-a-real-bar")).toBe(false);
  });
});

describe("barName", () => {
  it("returns the name for a real id", () => {
    expect(barName(BARS[0].id)).toBe(BARS[0].name);
  });
  it("returns null for an unknown id", () => {
    expect(barName("not-a-real-bar")).toBeNull();
  });
});
