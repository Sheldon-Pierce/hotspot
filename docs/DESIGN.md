# HotSpot — Design (2026-06-10)

## Goal

A GitHub-showcase demo of a neighborhood bar hotspot app: live-feeling occupancy for Ballard bars, a map + list of crowd levels, bar detail pages, and automatic incentives that reward going to quiet bars.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Occupancy source | Simulated live feed; manual check-in documented as a future option |
| Neighborhood | Ballard, Seattle — real bars, demo menus/deals |
| Stack | Next.js + TypeScript + Leaflet/OSM (no API keys, free Vercel deploy) |
| Incentives | Auto threshold deals (active below 35% capacity, expire at 50%) |

## Architecture

**Simulation as a pure function.** `occupancy(bar, timestamp)` is deterministic: time-of-day curve × day-of-week factor × bar popularity × seeded smooth noise. No database, no state — it runs identically on Vercel serverless, every viewer sees the same numbers, and history/trends are computed by evaluating the same function at past timestamps.

**One read API.** `GET /api/bars[?preset=id]` returns `BarStatus[]` (bar + count + ratio + level + trend + deals + 3h history). The client polls every 10 s. Time-travel presets resolve "next Friday 10 PM Pacific" server-side by scanning forward in 15-minute steps (DST-safe, no timezone math).

**Sensor-ready contract.** `CountEvent` (`{barId, delta, source: "door-sensor" | "check-in", at}`) defines the future ingestion shape. Real data replaces the simulator behind the same read API; the UI never changes.

**Deal engine.** Pure functions over `(bar, {open, ratio, time})`: incentive deal below the threshold, happy-hour deal inside seeded schedule windows. Both can stack.

**UI.** Single client page with three states: list view (sorted busiest-first, occupancy bars, trend arrows, deal badges), map view (Leaflet circle markers sized/colored by crowd level, dark CARTO tiles), and a detail drawer (gauge, sparkline, deals, menu, website). Header holds the view toggle and time-travel select.

## Error handling

- API fetch failures show a non-blocking banner; polling retries automatically.
- Unknown presets fall back to live time.
- Occupancy is clamped to [0, 1.05 × capacity]; closed bars are always 0.

## Testing

Vitest unit tests over the pure core: determinism, open-hours across midnight, bounds over a full simulated week, smooth drift, crowd-level mapping, deal thresholds/windows/stacking. UI is exercised by the production build and manual verification of `/api/bars` presets.
