import { describe, it, expect } from "vitest";
import {
  POINTS, checkinPoints, levelForPoints,
  isWithinCooldown, isNightOwlHour, evaluateBadges,
} from "@/lib/gamification/engine";

describe("checkinPoints", () => {
  it("awards base only for a repeat bar", () => {
    expect(checkinPoints(false)).toEqual([{ amount: POINTS.checkin, reason: "checkin" }]);
  });
  it("awards base + new-bar bonus for a new bar", () => {
    expect(checkinPoints(true)).toEqual([
      { amount: POINTS.checkin, reason: "checkin" },
      { amount: POINTS.newBar, reason: "new-bar" },
    ]);
  });
});

describe("levelForPoints", () => {
  it("starts at level 1", () => {
    expect(levelForPoints(0)).toBe(1);
    expect(levelForPoints(49)).toBe(1);
  });
  it("levels up on the curve", () => {
    expect(levelForPoints(50)).toBe(2);
    expect(levelForPoints(200)).toBe(3);
  });
});

describe("isWithinCooldown", () => {
  const now = new Date("2026-06-21T12:00:00Z");
  it("is false when there is no prior check-in", () => {
    expect(isWithinCooldown(null, now)).toBe(false);
  });
  it("is true within the window", () => {
    expect(isWithinCooldown(new Date("2026-06-21T11:00:00Z"), now)).toBe(true);
  });
  it("is false past the window", () => {
    expect(isWithinCooldown(new Date("2026-06-21T09:00:00Z"), now)).toBe(false);
  });
});

describe("isNightOwlHour", () => {
  it("is true from midnight to 4am", () => {
    expect(isNightOwlHour(0)).toBe(true);
    expect(isNightOwlHour(3)).toBe(true);
  });
  it("is false otherwise", () => {
    expect(isNightOwlHour(4)).toBe(false);
    expect(isNightOwlHour(12)).toBe(false);
    expect(isNightOwlHour(23)).toBe(false);
  });
});

describe("evaluateBadges", () => {
  it("awards first-round on the first check-in", () => {
    expect(evaluateBadges({ totalCheckins: 1, distinctBars: 1, maxCheckinsAtOneBar: 1, isNightOwl: false }))
      .toEqual(["first-round"]);
  });
  it("awards explorer tiers by distinct bars", () => {
    const r = evaluateBadges({ totalCheckins: 5, distinctBars: 5, maxCheckinsAtOneBar: 1, isNightOwl: false });
    expect(r).toContain("explorer-5");
    expect(r).not.toContain("explorer-10");
  });
  it("awards regular at 10 at one bar and night-owl when flagged", () => {
    const r = evaluateBadges({ totalCheckins: 12, distinctBars: 10, maxCheckinsAtOneBar: 10, isNightOwl: true });
    expect(r).toEqual(
      expect.arrayContaining(["first-round", "explorer-5", "explorer-10", "regular", "night-owl"]),
    );
  });
});
