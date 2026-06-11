import type { Bar, BarStatus, CrowdLevel, Trend } from "@/lib/types";
import { activeDeals } from "@/lib/deals";

/**
 * Deterministic occupancy simulation.
 *
 * Occupancy is a pure function of (bar, timestamp): a time-of-day curve
 * shaped around happy hour and the late-night peak, scaled by day-of-week
 * and the bar's popularity, with smooth seeded noise so every bar drifts
 * a little differently. Because it's deterministic and stateless, it runs
 * identically on serverless hosts and every viewer sees the same numbers.
 */

const TIME_ZONE = "America/Los_Angeles";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface LocalTime {
  /** 0 = Sunday .. 6 = Saturday */
  day: number;
  /** Fractional hour, e.g. 22.5 = 10:30 PM */
  hour: number;
}

export function localTime(date: Date): LocalTime {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const day = WEEKDAYS.indexOf(get("weekday"));
  // Intl may report midnight as "24" with hour12: false.
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  return { day, hour: hour + minute / 60 };
}

/** Relative busyness by day of week (Friday/Saturday = 1). */
const DAY_FACTOR = [0.45, 0.35, 0.42, 0.55, 0.7, 1.0, 1.0];

/**
 * Base activity curve over a bar day. Hours run 6 → 30, where 25 = 1 AM,
 * so the late-night peak doesn't wrap awkwardly at midnight.
 */
const HOUR_ANCHORS: [number, number][] = [
  [6, 0.02],
  [11, 0.06],
  [14, 0.12],
  [16, 0.3],
  [18, 0.38],
  [20, 0.55],
  [22, 0.92],
  [23.5, 1.0],
  [25, 0.75],
  [26, 0.35],
  [28, 0.05],
  [30, 0.02],
];

/** Map a clock hour onto the 6..30 "bar day" axis. */
function barDayHour(hour: number): number {
  return hour < 6 ? hour + 24 : hour;
}

function hourCurve(hour: number): number {
  const h = barDayHour(hour);
  for (let i = 1; i < HOUR_ANCHORS.length; i++) {
    const [h1, v1] = HOUR_ANCHORS[i - 1];
    const [h2, v2] = HOUR_ANCHORS[i];
    if (h <= h2) {
      const t = (h - h1) / (h2 - h1);
      return v1 + (v2 - v1) * Math.max(0, Math.min(1, t));
    }
  }
  return HOUR_ANCHORS[HOUR_ANCHORS.length - 1][1];
}

/** Deterministic hash → [0, 1). */
function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const NOISE_BUCKET_MS = 10 * 60 * 1000;

/**
 * Smooth per-bar noise in [0, 1]: random values at 10-minute buckets,
 * cosine-interpolated so counts drift rather than jump.
 */
function smoothNoise(barId: string, date: Date): number {
  const t = date.getTime() / NOISE_BUCKET_MS;
  const b0 = Math.floor(t);
  const frac = t - b0;
  const n0 = hash01(`${barId}:${b0}`);
  const n1 = hash01(`${barId}:${b0 + 1}`);
  const eased = (1 - Math.cos(frac * Math.PI)) / 2;
  return n0 + (n1 - n0) * eased;
}

export function isOpen(bar: Bar, time: LocalTime): boolean {
  const h = barDayHour(time.hour);
  const open = barDayHour(bar.openHour);
  // closeHour <= openHour means past midnight (e.g. 2 AM).
  const close =
    bar.closeHour <= bar.openHour ? bar.closeHour + 24 : bar.closeHour;
  return h >= open && h < close;
}

/** Headcount for a bar at a moment in time. Pure and deterministic. */
export function occupancy(bar: Bar, date: Date): number {
  const time = localTime(date);
  if (!isOpen(bar, time)) return 0;

  // The day "belongs to" the previous weekday after midnight.
  const day = time.hour < 6 ? (time.day + 6) % 7 : time.day;
  const popularityScale = 0.55 + 0.6 * bar.popularity;
  const noise = 0.78 + 0.44 * smoothNoise(bar.id, date);
  const ratio =
    hourCurve(time.hour) * DAY_FACTOR[day] * popularityScale * noise;
  return Math.round(Math.min(1.05, ratio) * bar.capacity);
}

export function crowdLevel(ratio: number, open: boolean): CrowdLevel {
  if (!open) return "closed";
  if (ratio < 0.25) return "quiet";
  if (ratio < 0.5) return "warming";
  if (ratio < 0.8) return "buzzing";
  return "packed";
}

const TREND_WINDOW_MS = 20 * 60 * 1000;

export function trend(bar: Bar, date: Date): Trend {
  const now = occupancy(bar, date);
  const before = occupancy(bar, new Date(date.getTime() - TREND_WINDOW_MS));
  const delta = (now - before) / bar.capacity;
  if (delta > 0.02) return "rising";
  if (delta < -0.02) return "falling";
  return "steady";
}

const HISTORY_POINTS = 12;
const HISTORY_STEP_MS = 15 * 60 * 1000;

export function history(bar: Bar, date: Date): { t: string; count: number }[] {
  const points: { t: string; count: number }[] = [];
  for (let i = HISTORY_POINTS - 1; i >= 0; i--) {
    const at = new Date(date.getTime() - i * HISTORY_STEP_MS);
    points.push({ t: at.toISOString(), count: occupancy(bar, at) });
  }
  return points;
}

/** Full live status for one bar — what /api/bars serves per entry. */
export function barStatus(bar: Bar, date: Date): BarStatus {
  const time = localTime(date);
  const open = isOpen(bar, time);
  const count = occupancy(bar, date);
  const ratio = Math.min(1.05, count / bar.capacity);
  return {
    bar,
    open,
    count,
    ratio,
    level: crowdLevel(ratio, open),
    trend: open ? trend(bar, date) : "steady",
    deals: activeDeals(bar, { open, ratio, time }),
    history: history(bar, date),
  };
}
