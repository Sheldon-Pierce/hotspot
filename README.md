# 🔥 HotSpot

**Live bar crowds for Ballard, Seattle.** See how busy every bar is right now on a hotspot map, and catch the deals quiet bars run to fill their rooms — free jello shots until the crowd shows up.

## What it does

- **Map view** — every bar in the neighborhood as a heat marker: green and small when quiet, red and big when packed. Built with Leaflet and free OpenStreetMap/CARTO tiles — no API keys required.
- **List view** — bars ranked by crowd, with live headcounts, occupancy bars, and trend arrows (filling up / emptying out).
- **Bar details** — tap any bar for menu highlights, active deals, happy hour info, a 3-hour crowd sparkline, and a link to their website.
- **Auto incentive deals** — when an open bar drops below 35% capacity, its incentive activates ("🎁 Free jello shots until we hit 60 people!") and expires on its own once the crowd recovers past 50%. Quiet bars get bodies in the door; everyone else gets cheap drinks.
- **Time travel** — live data on a Tuesday morning is (correctly) dead, so the header has presets to jump to Friday 10 PM, Thursday happy hour, etc.

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # simulation + deal engine tests
npm run build     # production build
```

Deploys to Vercel with zero configuration — no environment variables or API keys.

## How the "live" data works

There are no door sensors yet, so occupancy comes from a **deterministic simulation**: a pure function of `(bar, timestamp)`.

```
count = hourCurve(time) × dayFactor(weekday) × popularity(bar) × smoothNoise(bar, time) × capacity
```

- `hourCurve` shapes the day — happy hour ramp at 4 PM, peak at ~11:30 PM, last call decline until 2 AM.
- `dayFactor` makes Friday/Saturday peak and Monday die.
- `smoothNoise` is seeded per-bar noise, cosine-interpolated over 10-minute buckets, so counts drift realistically instead of jumping.

Because it's deterministic and stateless, it runs on serverless hosts with no database, every viewer sees the same numbers, and the UI polling `/api/bars` every 10 seconds feels live.

## Architecture

```
data/bars.ts          seed data: 11 real Ballard bars (demo menus & deals)
lib/simulation.ts     deterministic occupancy engine (pure functions)
lib/deals.ts          incentive thresholds + happy hour windows
lib/presets.ts        time-travel preset resolution (Pacific time)
app/api/bars/route.ts GET /api/bars[?preset=id] — the read API
lib/useBars.ts        client polling hook (10s)
components/           Header, BarList, BarMap (Leaflet), BarDetail, Sparkline
```

The UI only ever talks to `/api/bars`, so swapping the simulator for real data is an API-layer change.

### Plugging in real occupancy data

The ingestion contract is already defined (`CountEvent` in `lib/types.ts`):

```ts
POST /api/events
{ "barId": "kings-hardware", "delta": +2, "source": "door-sensor", "at": "..." }
```

A real deployment would aggregate these events into per-bar counts (any KV store works) and have `/api/bars` read from that instead of the simulator. Two sources fit the same contract:

1. **Door sensors** — IR beam or camera-based people counters at the entrance posting entry/exit deltas.
2. **Manual check-in** *(planned alternative)* — a Foursquare-style "I'm here" / "I left" button in the app, with `source: "check-in"`. Zero hardware cost; accuracy depends on adoption. A hybrid (sensors at flagship bars, check-ins elsewhere) also works since both are just `CountEvent`s.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · React Leaflet · Vitest

## Disclaimer

The bars are real Ballard establishments with approximate coordinates, but all headcounts, capacities, menus, prices, and deals are **simulated demo data** — invented for this showcase and not affiliated with or endorsed by the businesses.
