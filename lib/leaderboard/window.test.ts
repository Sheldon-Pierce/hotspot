import { describe, it, expect } from "vitest";
import { windowStart } from "@/lib/leaderboard/window";

const now = new Date("2026-06-21T12:00:00Z");

describe("windowStart", () => {
  it("returns null for all-time", () => {
    expect(windowStart("all", now)).toBeNull();
  });
  it("returns 7 days ago for the week window", () => {
    expect(windowStart("week", now)?.toISOString()).toBe("2026-06-14T12:00:00.000Z");
  });
});
