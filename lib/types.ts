/** A bar in the neighborhood, as stored in seed data. */
export interface Bar {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Max comfortable headcount used to compute crowd ratios. */
  capacity: number;
  /** 0..1 — how busy this bar runs relative to the neighborhood. */
  popularity: number;
  /** Opening hour, 24h local (Pacific) time. */
  openHour: number;
  /** Closing hour; values <= openHour mean past midnight (e.g. 2 = 2 AM). */
  closeHour: number;
  vibe: string[];
  website: string | null;
  menuHighlights: { name: string; price: string }[];
  happyHour: {
    /** 0 = Sunday .. 6 = Saturday */
    days: number[];
    startHour: number;
    endHour: number;
    description: string;
  } | null;
  /** Incentive offered when the bar is quiet, e.g. "Free jello shots". */
  incentive: string;
}

export type DealType = "incentive" | "happy-hour";

export interface Deal {
  barId: string;
  type: DealType;
  title: string;
  description: string;
}

export type CrowdLevel = "closed" | "quiet" | "warming" | "buzzing" | "packed";
export type Trend = "rising" | "falling" | "steady";

/** A bar plus its live (simulated) state, as served by /api/bars. */
export interface BarStatus {
  bar: Bar;
  open: boolean;
  count: number;
  /** count / capacity, clamped to [0, 1.05]. */
  ratio: number;
  level: CrowdLevel;
  trend: Trend;
  deals: Deal[];
  /** Last 3 hours of counts at 15-minute intervals, oldest first. */
  history: { t: string; count: number }[];
}

export interface BarsResponse {
  generatedAt: string;
  bars: BarStatus[];
}

/**
 * The ingestion contract for real occupancy sources (door sensors or
 * manual check-ins). Not used by the simulator, but the API layer is
 * shaped so a `POST /api/events` endpoint accepting these can replace
 * the simulation without touching the UI.
 */
export interface CountEvent {
  barId: string;
  /** +n people entered, -n people left. */
  delta: number;
  source: "door-sensor" | "check-in";
  at: string; // ISO timestamp
}
