import { describe, expect, it } from "vitest";
import { BARS } from "@/data/bars";
import {
  barStatus,
  crowdLevel,
  isOpen,
  localTime,
  occupancy,
} from "@/lib/simulation";
import type { Bar } from "@/lib/types";

// June 2026, Pacific Daylight Time (UTC-7).
const FRIDAY_10PM = new Date("2026-06-12T22:00:00-07:00");
const TUESDAY_10AM = new Date("2026-06-09T10:00:00-07:00");
const MONDAY_4AM = new Date("2026-06-08T04:00:00-07:00");
const SATURDAY_1AM = new Date("2026-06-13T01:00:00-07:00"); // Friday night, after midnight

const kings = BARS.find((b) => b.id === "kings-hardware")!;

describe("localTime", () => {
  it("converts to Pacific weekday and fractional hour", () => {
    const t = localTime(new Date("2026-06-12T22:30:00-07:00"));
    expect(t.day).toBe(5); // Friday
    expect(t.hour).toBeCloseTo(22.5);
  });
});

describe("isOpen", () => {
  it("handles closing hours past midnight", () => {
    // King's: open 12 PM – 2 AM
    expect(isOpen(kings, localTime(FRIDAY_10PM))).toBe(true);
    expect(isOpen(kings, localTime(SATURDAY_1AM))).toBe(true);
    expect(isOpen(kings, localTime(MONDAY_4AM))).toBe(false);
  });
});

describe("occupancy", () => {
  it("is deterministic — same inputs, same output", () => {
    expect(occupancy(kings, FRIDAY_10PM)).toBe(occupancy(kings, FRIDAY_10PM));
  });

  it("is zero when closed", () => {
    expect(occupancy(kings, MONDAY_4AM)).toBe(0);
  });

  it("stays within plausible bounds for every bar at any hour", () => {
    for (const bar of BARS) {
      for (let h = 0; h < 24 * 7; h++) {
        const at = new Date(MONDAY_4AM.getTime() + h * 60 * 60 * 1000);
        const count = occupancy(bar, at);
        expect(count).toBeGreaterThanOrEqual(0);
        expect(count).toBeLessThanOrEqual(Math.ceil(bar.capacity * 1.05));
      }
    }
  });

  it("is busier on Friday night than Tuesday morning", () => {
    expect(occupancy(kings, FRIDAY_10PM)).toBeGreaterThan(
      occupancy(kings, TUESDAY_10AM)
    );
  });

  it("drifts smoothly — no jumps over one minute", () => {
    for (let m = 0; m < 60; m++) {
      const a = occupancy(kings, new Date(FRIDAY_10PM.getTime() + m * 60_000));
      const b = occupancy(
        kings,
        new Date(FRIDAY_10PM.getTime() + (m + 1) * 60_000)
      );
      expect(Math.abs(a - b)).toBeLessThan(kings.capacity * 0.1);
    }
  });
});

describe("crowdLevel", () => {
  it("maps ratios to levels", () => {
    expect(crowdLevel(0, false)).toBe("closed");
    expect(crowdLevel(0.1, true)).toBe("quiet");
    expect(crowdLevel(0.3, true)).toBe("warming");
    expect(crowdLevel(0.6, true)).toBe("buzzing");
    expect(crowdLevel(0.9, true)).toBe("packed");
  });
});

describe("barStatus", () => {
  it("returns consistent count/ratio and 12 history points", () => {
    const status = barStatus(kings, FRIDAY_10PM);
    expect(status.ratio).toBeCloseTo(status.count / kings.capacity, 5);
    expect(status.history).toHaveLength(12);
    expect(status.history.at(-1)!.count).toBe(status.count);
  });

  it("activates the incentive deal only when quiet", () => {
    const quietBar: Bar = { ...kings, popularity: 0.05 };
    const tuesday = new Date("2026-06-09T14:00:00-07:00");
    const status = barStatus(quietBar, tuesday);
    expect(status.ratio).toBeLessThan(0.35);
    expect(status.deals.some((d) => d.type === "incentive")).toBe(true);

    const busy = barStatus(kings, FRIDAY_10PM);
    if (busy.ratio >= 0.35) {
      expect(busy.deals.some((d) => d.type === "incentive")).toBe(false);
    }
  });
});
