import { describe, expect, it } from "vitest";
import { BARS } from "@/data/bars";
import {
  activeDeals,
  happyHourDeal,
  incentiveDeal,
  INCENTIVE_THRESHOLD,
} from "@/lib/deals";

const kings = BARS.find((b) => b.id === "kings-hardware")!;

describe("incentiveDeal", () => {
  it("activates below the threshold while open", () => {
    const deal = incentiveDeal(kings, {
      open: true,
      ratio: INCENTIVE_THRESHOLD - 0.01,
      time: { day: 2, hour: 15 },
    });
    expect(deal).not.toBeNull();
    expect(deal!.type).toBe("incentive");
    expect(deal!.description).toContain("60 people"); // 50% of 120
  });

  it("does not activate at or above the threshold", () => {
    expect(
      incentiveDeal(kings, {
        open: true,
        ratio: INCENTIVE_THRESHOLD,
        time: { day: 2, hour: 15 },
      })
    ).toBeNull();
  });

  it("does not activate when closed", () => {
    expect(
      incentiveDeal(kings, { open: false, ratio: 0, time: { day: 2, hour: 4 } })
    ).toBeNull();
  });
});

describe("happyHourDeal", () => {
  // King's: Mon–Fri, 4–6 PM
  it("activates inside the window", () => {
    const deal = happyHourDeal(kings, {
      open: true,
      ratio: 0.5,
      time: { day: 3, hour: 17 },
    });
    expect(deal).not.toBeNull();
    expect(deal!.type).toBe("happy-hour");
  });

  it("respects the day list and hour bounds", () => {
    const sunday = happyHourDeal(kings, {
      open: true,
      ratio: 0.5,
      time: { day: 0, hour: 17 },
    });
    expect(sunday).toBeNull();

    const tooLate = happyHourDeal(kings, {
      open: true,
      ratio: 0.5,
      time: { day: 3, hour: 18 },
    });
    expect(tooLate).toBeNull();
  });
});

describe("activeDeals", () => {
  it("can stack incentive and happy hour", () => {
    const deals = activeDeals(kings, {
      open: true,
      ratio: 0.1,
      time: { day: 3, hour: 17 },
    });
    expect(deals.map((d) => d.type).sort()).toEqual([
      "happy-hour",
      "incentive",
    ]);
  });
});
