import { localTime } from "@/lib/simulation";

/**
 * Time-travel presets for the demo. Live data on a Tuesday morning is
 * (correctly) dead, so the UI offers jumps to interesting moments. Each
 * preset resolves to the next upcoming occurrence of a weekday + hour
 * in Pacific time.
 */

export interface TimePreset {
  id: string;
  label: string;
  /** 0 = Sunday .. 6 = Saturday */
  day: number;
  hour: number;
}

export const TIME_PRESETS: TimePreset[] = [
  { id: "friday-night", label: "Friday 10 PM", day: 5, hour: 22 },
  { id: "saturday-night", label: "Saturday 11 PM", day: 6, hour: 23 },
  { id: "thursday-happy-hour", label: "Thursday 5 PM", day: 4, hour: 17 },
  { id: "sunday-evening", label: "Sunday 7 PM", day: 0, hour: 19 },
  { id: "tuesday-afternoon", label: "Tuesday 3 PM", day: 2, hour: 15 },
];

const STEP_MS = 15 * 60 * 1000;
const MAX_LOOKAHEAD_MS = 8 * 24 * 60 * 60 * 1000;

/**
 * Find the next moment whose Pacific-time weekday and hour match the
 * preset. Scans forward in 15-minute steps, which stays correct across
 * DST transitions without any timezone math.
 */
export function resolvePreset(presetId: string, from: Date): Date | null {
  const preset = TIME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const start = Math.ceil(from.getTime() / STEP_MS) * STEP_MS;
  for (let t = start; t <= start + MAX_LOOKAHEAD_MS; t += STEP_MS) {
    const candidate = new Date(t);
    const { day, hour } = localTime(candidate);
    if (day === preset.day && Math.floor(hour) === preset.hour && hour - preset.hour < 0.25) {
      return candidate;
    }
  }
  return null;
}
