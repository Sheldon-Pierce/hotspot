# HotSpot — Neon Nightlife Redesign

**Status:** Approved direction (2026-06-21). Reference mockup: the published "neon-home-mockup" artifact.

## 1. Summary

A full visual redesign of HotSpot in a **neon nightlife** aesthetic: near-black glassy base, a restrained neon accent set, and crowd data turned into the visual hook via glowing "heat" meters. Motion via **Framer Motion** throughout, plus **one three.js showpiece** (an animated neon aurora) on the login screen with a subtle echo behind the map header. The redesign is **purely presentational** — it must not change app behavior, data, auth, or the API. It applies coherently to every page and stays responsive/touch-first to ease the future mobile app.

## 2. Goals & non-goals

### Goals
- Replace the current flat dark-zinc/amber look with a cohesive, striking neon-nightlife system.
- A shared design-token system + restyled shared components that cascade to all pages.
- Make live crowd data the centerpiece (glowing heat meters, crowd-colored card halos).
- Tasteful motion (Framer Motion) and one performant three.js aurora showpiece.
- Stay fast and responsive; respect `prefers-reduced-motion`; don't regress accessibility.

### Non-goals (out of scope)
- **No behavior/data/auth/API changes.** Routing, gating, server actions, queries, and tests stay as-is. (Crowd-engine files remain untouched per project rule.)
- **Not** the mobile app itself (separate future project) — but keep layouts responsive/touch-friendly.
- No 3D map / WebGL map rearchitecting — the Leaflet map is **re-themed**, not replaced.
- No new product features.

## 3. Design tokens (the system)

Defined as CSS custom properties in `app/globals.css` and surfaced to Tailwind 4 via `@theme`. Single source of truth; components reference tokens, never raw hexes.

```
Base:     --bg #08080d   --bg-2 #0c0c16
Surface:  --surface rgba(255,255,255,.045)   --surface-2 rgba(255,255,255,.07)
Hairline: --hair rgba(255,255,255,.09)
Text:     --text #ECECF3   --muted #9aa0b4   --faint #6b7185
Neon:     --magenta #ff2d78 (brand/heat-high)   --cyan #22d3ee (cool/quiet)
          --amber #fbbf24 (warm/mid)   --green #34d399 (open/positive)   --violet #7c3aed (aurora)
Radius:   --r-card 18px  --r-control 12px  --r-pill 999px
Glow:     a `neon-glow(color, strength)` utility = layered box/text-shadow at low alpha.
```

**Heat scale (the signature):** crowd level maps to color + glow — `quiet`→cyan/green, `warming`→cyan→amber, `buzzing`→amber, `packed`→amber→magenta with a magenta card halo. Centralized in `lib/ui.ts` (`LEVEL_META`/`TREND_META` colors updated to the neon scale; this is the one logic-adjacent file the redesign touches, and only its color values).

**Restraint rule:** glow only on meaningful elements (logo, heat meters, active/selected states, rank #1, earned badges). Surfaces stay calm glass. Prevents "garish."

**Typography:** keep Geist; add tight tracking + a neon text-glow on the logo and key headings. Establish a type scale (display / h1 / h2 / body / caption).

## 4. Motion (Framer Motion)

Add `framer-motion`. Patterns:
- **Route transitions:** a subtle fade/slide on navigation (App Router `template.tsx`).
- **List stagger:** bar list, feed, leaderboard, badge case animate in with a small stagger.
- **Cards:** lift + glow intensify on hover/tap (`whileHover`/`whileTap`).
- **Live pulse:** the "Live now" dot and packed-bar halos pulse gently.
- **Heat meters:** animate width to the level on load and re-animate when the 10s poll changes a count.
- **Check-in feedback:** points/badge toast springs in.
- **Reduced motion:** all of the above gate on `useReducedMotion()` — collapse to instant/no-motion.

## 5. three.js showpiece

A single isolated component `components/Aurora.tsx` (client, `dynamic(..., { ssr:false })`, lazy):
- A full-viewport animated neon gradient/aurora field (shader plane or low-poly blurred blobs) in magenta/cyan/violet.
- **Login/signup:** full-screen behind the auth card (first impression of the now fully-gated app).
- **Map header:** a smaller, dimmer echo behind the nav/header on the home page.
- **Performance/safeguards:** lazy-loaded so it never bloats other routes; cap to ~30fps; pause when tab hidden / element offscreen; **static CSS-gradient fallback** when `prefers-reduced-motion` or WebGL unavailable. Must not block interaction or harm Lighthouse/mobile battery meaningfully.

## 6. Component & page application

**Shared (restyled once, cascade everywhere):**
- `SiteNav` — glass blur bar, neon logo, hover-glow links, gradient avatar chip.
- `Header` (home controls) — glass pill controls, glowing active segment, pulsing live dot.
- `BarList` card — glass card, heat meter, crowd halo, neon star, deal pill, Motion lift/stagger.
- `BarDetail` — glass sheet, big heat meter, neon sparkline, glowing deal cards, prominent neon "I'm here" check-in.
- `BarMap` (Leaflet) — **re-theme**: dark tile layer + neon glowing markers sized/colored by heat (reuse `LEVEL_META`).
- `Avatar` — optional neon ring; `Sparkline` — neon stroke + glow; buttons/inputs — token-based neon styles.

**Per page:**
- **Login/signup/onboarding:** Aurora backdrop + centered glass card; the redesign's showcase.
- **Profile (`/profile`, `/u/[username]`):** gradient avatar with level ring, glowing badge case, neon stat row, heat-styled recent check-ins.
- **Friends:** glass rows, neon request/accept buttons, search results.
- **Feed:** neon check-in cards with heat-colored accents + relative time.
- **Leaderboard:** glowing rank #1 (magenta crown), gradient rank numbers, highlighted viewer row.

## 7. Technical approach

- **Deps:** `framer-motion`; `three` + `@react-three/fiber` (Aurora only). Aurora dynamically imported so `three` is not in the shared/initial bundle.
- **Tokens:** `app/globals.css` (`:root` vars + Tailwind `@theme`). Components migrate to tokens.
- **Isolation:** restyle shared components first (cascades), then page-specific polish. No changes to server actions, queries, routes, schema, or `lib/` logic except `lib/ui.ts` color values.
- **Crowd engine untouched:** `app/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, `data/bars.ts` unchanged.
- **Verification:** `npm test` (59) stays green (behavior unchanged); `tsc` clean; `npm run build` green and still builds without `DATABASE_URL`; dev-server visual spot-check per page; reduced-motion + mobile-width checks.

## 8. Accessibility & performance

- Maintain WCAG-AA text contrast against the dark base (neon used for accents/large text/glow, not small body text on low-contrast surfaces).
- `prefers-reduced-motion` disables Motion animations and the Aurora animation (static fallback).
- Aurora lazy + fps-capped + visibility-paused; redesign must not meaningfully regress initial load.
- Touch targets ≥ 44px; layouts fluid from ~360px up.

## 9. Open items (confirm at implementation)
- Exact final neon hex tuning (start from §3; adjust live).
- Aurora implementation detail (shader vs blurred instanced blobs) — pick the lighter that looks right.
- Dark map tile provider (CARTO dark matter, keeping the no-API-key property).
