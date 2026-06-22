import { describe, it, expect } from "vitest";
import { timeAgo } from "@/lib/timeAgo";

const now = new Date("2026-06-21T12:00:00Z");

describe("timeAgo", () => {
  it("'just now' under a minute", () => {
    expect(timeAgo(new Date("2026-06-21T11:59:30Z"), now)).toBe("just now");
  });
  it("minutes", () => {
    expect(timeAgo(new Date("2026-06-21T11:55:00Z"), now)).toBe("5m ago");
  });
  it("hours", () => {
    expect(timeAgo(new Date("2026-06-21T10:00:00Z"), now)).toBe("2h ago");
  });
  it("days", () => {
    expect(timeAgo(new Date("2026-06-18T12:00:00Z"), now)).toBe("3d ago");
  });
});
