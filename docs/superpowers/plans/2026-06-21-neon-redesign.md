# Neon Nightlife Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin all of HotSpot in the approved neon-nightlife aesthetic (glassy near-black base, neon heat meters, Framer Motion, one three.js aurora) with **zero behavior change**.

**Architecture:** A design-token layer (`globals.css` + `lib/ui.ts` colors) and a set of reusable primitives (`.glass`/glow utilities, `HeatMeter`, motion variants) land first; every page/component then restyles by applying those primitives. The Leaflet map is re-themed (dark tiles + neon markers), not replaced. The three.js aurora is one isolated, lazy, fps-capped component. Reference look: the approved "neon-home-mockup" artifact.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Framer Motion, three + @react-three/fiber (aurora only), Leaflet, Vitest.

## Global Constraints

- **Purely presentational — NO behavior/data/auth/API/route changes.** `npm test` must stay **59 passing** the whole way (proves behavior unchanged).
- **Do NOT modify** `app/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, `data/bars.ts`. The only logic-adjacent file touched is `lib/ui.ts` (color values in `LEVEL_META`/`TREND_META` only).
- **Tokens are the single source of truth** (defined in `app/globals.css`); components reference tokens/utilities, never raw hexes.
- **Restraint rule:** neon glow only on meaningful elements (logo, heat meters, active/selected states, rank #1, earned badges). Surfaces stay calm glass.
- **`prefers-reduced-motion`:** all Motion + the aurora animation must disable to static under it.
- **Aurora** is `dynamic(..., { ssr:false })`, fps-capped (~30), paused when tab hidden, with a CSS-gradient fallback — never in the shared/initial bundle.
- **Accessibility:** WCAG-AA contrast for text; touch targets ≥44px; layouts fluid from ~360px.
- **Per task:** `tsc --noEmit` exit 0, `npm run build` exit 0 (still builds without `DATABASE_URL`), `npm test` 59 green, and a named dev-server visual check. **Commits:** small; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File structure

- `app/globals.css` — tokens (`:root` vars + Tailwind `@theme`) + utility classes (`.glass`, `.neon-text`, `.glow-*`).
- `lib/ui.ts` — `LEVEL_META`/`TREND_META` colors → neon heat scale (+ test).
- `lib/motion.ts` *(new)* — shared Framer Motion variants + a `useReduced()` helper.
- `app/template.tsx` *(new)* — route transition wrapper.
- `components/ui/HeatMeter.tsx`, `components/ui/Pill.tsx` *(new)* — reused primitives.
- `components/Aurora.tsx` *(new)* — three.js showpiece.
- Restyle existing: `SiteNav`, `Header`, `BarList`, `BarDetail`, `BarMap`, `Avatar`, `Sparkline`, profile/friends/feed/leaderboard/auth components + `app/layout.tsx`, `app/globals.css`.

---

## Task 1: Dependencies + design tokens + heat colors

**Files:** Modify `package.json`, `app/globals.css`, `lib/ui.ts`; Create `lib/ui.test.ts`.

**Interfaces:** Produces CSS vars (`--bg`, `--magenta`, …) + utility classes `.glass`, `.neon-text`, `.glow`; `LEVEL_META[level].color` returns the neon hex per crowd level.

- [ ] **Step 1: Install deps**

```bash
npm install framer-motion three @react-three/fiber
npm install -D @types/three
```

- [ ] **Step 2: Add tokens + utilities to `app/globals.css`**

Append (keep existing Tailwind import at top):

```css
:root{
  --bg:#08080d; --bg-2:#0c0c16;
  --surface:rgba(255,255,255,.045); --surface-2:rgba(255,255,255,.07);
  --hair:rgba(255,255,255,.09);
  --text:#ECECF3; --muted:#9aa0b4; --faint:#6b7185;
  --magenta:#ff2d78; --cyan:#22d3ee; --amber:#fbbf24; --green:#34d399; --violet:#7c3aed;
  --r-card:18px; --r-control:12px;
}
@theme inline {
  --color-bg: var(--bg);
  --color-magenta: var(--magenta);
  --color-cyan: var(--cyan);
  --color-amber: var(--amber);
}
html,body{ background:var(--bg); color:var(--text); }
.glass{ background:var(--surface); border:1px solid var(--hair); backdrop-filter:blur(8px); }
.glass-strong{ background:var(--surface-2); border:1px solid var(--hair); backdrop-filter:blur(14px); }
.neon-text{ text-shadow:0 0 18px rgba(255,45,120,.6), 0 0 4px rgba(255,45,120,.85); }
.glow{ box-shadow:0 0 24px -6px var(--glow,rgba(255,45,120,.5)); }
@media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; } }
```

- [ ] **Step 3: Write the failing test for neon heat colors**

```ts
// lib/ui.test.ts
import { describe, it, expect } from "vitest";
import { LEVEL_META } from "@/lib/ui";

describe("LEVEL_META neon heat colors", () => {
  it("maps quiet→cyan-ish, packed→magenta", () => {
    expect(LEVEL_META.quiet.color.toLowerCase()).toBe("#22d3ee");
    expect(LEVEL_META.packed.color.toLowerCase()).toBe("#ff2d78");
  });
});
```

- [ ] **Step 4: Run it (RED)** — `npx vitest run lib/ui.test.ts` → FAIL (colors differ).

- [ ] **Step 5: Update `lib/ui.ts` colors** to the neon heat scale — set `LEVEL_META` colors: `closed`→`#6b7185`, `quiet`→`#22d3ee`, `warming`→`#5eead4`, `buzzing`→`#fbbf24`, `packed`→`#ff2d78`. Leave all labels/keys/logic and `TREND_META` icons unchanged (only colors). Read the file first and replace only the `color` values.

- [ ] **Step 6: Run it (GREEN)** — `npx vitest run lib/ui.test.ts` → PASS.

- [ ] **Step 7: Verify + commit** — `npx tsc --noEmit` (0), `npm test` (60 now: 59 + this), `npm run build` (0). Then:

```bash
git add package.json package-lock.json app/globals.css lib/ui.ts lib/ui.test.ts
git commit -m "feat(redesign): neon tokens, utilities, and heat colors"
```

---

## Task 2: Reusable primitives — HeatMeter + Pill

**Files:** Create `components/ui/HeatMeter.tsx`, `components/ui/Pill.tsx`.

**Interfaces:** Produces `HeatMeter({ ratio, level })` and `Pill({ tone, children })` (`tone: "neutral"|"deal"|"live"`). Consumes `LEVEL_META` (Task 1).

- [ ] **Step 1: HeatMeter** — the signature element (glowing bar colored by level).

```tsx
// components/ui/HeatMeter.tsx
import type { CrowdLevel } from "@/lib/types";
import { LEVEL_META } from "@/lib/ui";

const GRADIENT: Record<CrowdLevel, string> = {
  closed: "var(--faint), var(--faint)",
  quiet: "var(--cyan), var(--green)",
  warming: "var(--cyan), var(--amber)",
  buzzing: "var(--cyan), var(--amber)",
  packed: "var(--amber), var(--magenta)",
};

export default function HeatMeter({ ratio, level }: { ratio: number; level: CrowdLevel }) {
  const color = LEVEL_META[level].color;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[.07]">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${Math.min(100, Math.max(4, ratio * 100))}%`,
          backgroundImage: `linear-gradient(90deg, ${GRADIENT[level]})`,
          boxShadow: `0 0 14px ${color}`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Pill** — small status/label chip.

```tsx
// components/ui/Pill.tsx
const TONES = {
  neutral: "bg-white/[.07] text-zinc-300 border-white/10",
  deal: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  live: "bg-white/[.05] text-white border-white/10",
} as const;

export default function Pill({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Verify + commit** — `tsc` 0, `build` 0 (components unused yet is fine). Commit:

```bash
git add components/ui/HeatMeter.tsx components/ui/Pill.tsx
git commit -m "feat(redesign): HeatMeter + Pill primitives"
```

---

## Task 3: Motion foundation

**Files:** Create `lib/motion.ts`, `app/template.tsx`.

**Interfaces:** Produces `variants` (`fadeUp`, `stagger`, `card`) and `useReduced()` from `@/lib/motion`; a route-transition `template.tsx` wrapping all pages.

- [ ] **Step 1: Shared variants + reduced-motion helper**

```ts
// lib/motion.ts
"use client";
import { useReducedMotion } from "framer-motion";

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
export const card = {
  rest: { y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } },
};
export function useReduced() {
  return useReducedMotion();
}
```

- [ ] **Step 2: Route transition template**

```tsx
// app/template.tsx
"use client";
import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: Verify + commit** — `tsc` 0, `build` 0; dev server: navigating between pages fades. Commit:

```bash
git add lib/motion.ts app/template.tsx
git commit -m "feat(redesign): Framer Motion variants + route transitions"
```

---

## Task 4: Global shell — SiteNav + layout

**Files:** Modify `components/SiteNav.tsx`, `app/layout.tsx`, `components/auth/UserMenu.tsx`.

**Interfaces:** Consumes `.glass`/`.neon-text` (Task 1). No prop/behavior changes — restyle only.

- [ ] **Step 1: Restyle SiteNav** — glass blur bar, neon logo, hover-glow links. Replace the `<header>`/inner markup classes (keep the `<Link href="/">` logo and `<UserMenu/>` structure):

```tsx
// components/SiteNav.tsx — within the existing component
<header className="sticky top-0 z-[1100] glass-strong border-b border-[var(--hair)]">
  <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
    <Link href="/" className="mr-auto" aria-label="HotSpot — back to the map">
      <span className="neon-text text-xl font-extrabold tracking-tight text-white">🔥 HotSpot</span>
    </Link>
    <UserMenu />
  </div>
</header>
```

- [ ] **Step 2: Restyle UserMenu links** — neon-hover links + gradient avatar chip. Update the logged-in block's link classes to `text-zinc-300 hover:text-white transition-colors` and render the avatar/initials chip with `background: linear-gradient(135deg,var(--cyan),var(--magenta))` + `.glow`. Keep all hrefs, `useSession`, `signOut` behavior unchanged.

- [ ] **Step 3: Layout base** — confirm `app/layout.tsx` body uses the token bg (already `var(--bg)` via globals). No change needed beyond Task 1's `html,body` rule; verify the body class is `min-h-full flex flex-col` (unchanged).

- [ ] **Step 4: Verify + commit** — `tsc` 0, `npm test` 60 green, `build` 0; dev server: nav is glassy with a glowing logo on every page. Commit:

```bash
git add components/SiteNav.tsx components/auth/UserMenu.tsx
git commit -m "feat(redesign): neon glass global nav"
```

---

## Task 5: Home — controls, bar cards, map theme

**Files:** Modify `components/Header.tsx`, `components/BarList.tsx`, `components/BarMap.tsx`.

**Interfaces:** Consumes `HeatMeter`, `Pill` (Task 2), `card`/`stagger` variants (Task 3), `LEVEL_META`. No prop changes.

- [ ] **Step 1: Header controls** — glass pill select + glowing active segment + pulsing live indicator. Restyle the existing `<select>` and view-toggle with `.glass` containers; active toggle button gets `bg-[var(--amber)] text-[#06060a]` + `.glow` (set `--glow` to amber). Keep `onViewChange`/`onPresetChange`/props unchanged.

- [ ] **Step 2: BarList card** — glass card + HeatMeter + crowd halo + neon star + Motion. Replace the card body (keep `onSelect`/`onToggleFavorite`/`favorites` logic and the `<li>`/star button structure from the favorites feature):

```tsx
// key markup inside the mapped <li> — uses motion + primitives
<motion.div variants={card} initial="rest" whileHover="hover"
  className="glass rounded-[var(--r-card)] p-4 pr-12"
  style={status.level === "packed" ? { boxShadow: "0 0 30px -8px var(--magenta)" } : undefined}>
  <div className="flex items-center gap-3">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_META[status.level].color, boxShadow: `0 0 10px ${LEVEL_META[status.level].color}` }} />
    <span className="truncate font-semibold text-zinc-100">{bar.name}</span>
    {incentive && <Pill tone="deal">🎁 {incentive.title}</Pill>}
    <span className="ml-auto text-sm tabular-nums text-zinc-300">…count…</span>
  </div>
  {status.open && (
    <div className="mt-3">
      <HeatMeter ratio={status.ratio} level={status.level} />
      <div className="mt-2 flex justify-between text-xs" style={{ color: LEVEL_META[status.level].color }}>
        <span className="font-semibold uppercase">{LEVEL_META[status.level].label} {trendMeta.icon}</span>
      </div>
    </div>
  )}
</motion.div>
```

Wrap the `<ul>` with `motion.ul variants={stagger} initial="hidden" animate="show"` and each item `variants={fadeUp}`. The favorite star stays the absolutely-positioned sibling button (unchanged logic), restyled with amber glow when active.

- [ ] **Step 3: Map dark theme + neon markers** — in `components/BarMap.tsx`, switch the tile layer URL to CARTO **dark matter** (no API key) and color/glow the markers by `LEVEL_META[level].color` (divIcon with a glowing dot sized by ratio). Keep `onSelect` and the markers' data wiring unchanged.

- [ ] **Step 4: Verify + commit** — `tsc` 0, `npm test` 60, `build` 0; dev server (logged in): list cards are glassy with glowing heat meters that match the mockup; packed bars halo magenta; map is dark with neon markers; toggling list/map works. Commit:

```bash
git add components/Header.tsx components/BarList.tsx components/BarMap.tsx
git commit -m "feat(redesign): neon home — controls, heat-meter cards, dark map"
```

---

## Task 6: Bar detail

**Files:** Modify `components/BarDetail.tsx`, `components/Sparkline.tsx`.

**Interfaces:** Consumes `HeatMeter`, `Pill`, `LEVEL_META`. No prop/behavior changes (favorite + check-in wiring intact).

- [ ] **Step 1: BarDetail sheet** — glass panel, big HeatMeter, glowing deal cards, neon "I'm here" button. Restyle the existing aside/sections: container `glass-strong`, replace the inline occupancy bar with `<HeatMeter ratio={status.ratio} level={status.level} />`, deal cards get a colored glow border, the `CheckInButton` keeps its logic but its button gets `.glow` (magenta). Keep `isFavorite`/`onToggleFavorite`/`isLoggedIn`/`onClose` props + the favorite star + `<CheckInButton/>` placement unchanged.

- [ ] **Step 2: Sparkline neon** — set the stroke to the level color and add a soft `filter: drop-shadow(0 0 4px <color>)`. Keep the points/data props unchanged.

- [ ] **Step 3: Verify + commit** — `tsc` 0, `npm test` 60, `build` 0; dev server: open a bar → glassy sheet, glowing meter + sparkline, neon check-in button; checking in still works (toast). Commit:

```bash
git add components/BarDetail.tsx components/Sparkline.tsx
git commit -m "feat(redesign): neon bar-detail sheet"
```

---

## Task 7: three.js aurora + auth pages

**Files:** Create `components/Aurora.tsx`; Modify `app/login/page.tsx`, `app/signup/page.tsx`, `app/onboarding/page.tsx`, `components/auth/AuthForm.tsx`.

**Interfaces:** Produces `<Aurora variant="full"|"header" />` (default export, client, lazy). Consumes neon tokens.

- [ ] **Step 1: Aurora component** — R3F gradient field, fps-capped, visibility-paused, reduced-motion + no-WebGL fallback.

```tsx
// components/Aurora.tsx
"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

function Blobs() {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.15) * 0.15;
  });
  const mk = (x: number, y: number, c: string, scale: number) => (
    <mesh position={[x, y, 0]} scale={scale}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={c} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
    </mesh>
  );
  return (
    <group ref={g}>
      {mk(-1.4, 0.8, "#ff2d78", 2.2)}
      {mk(1.6, 1.0, "#22d3ee", 1.9)}
      {mk(0.2, -0.2, "#7c3aed", 1.4)}
    </group>
  );
}

export default function Aurora({ variant = "full" }: { variant?: "full" | "header" }) {
  const reduced = useReducedMotion();
  const cls =
    variant === "full" ? "fixed inset-0 -z-10" : "absolute inset-0 -z-10 opacity-60";
  // Static fallback: a blurred CSS gradient (also used under reduced-motion).
  if (reduced) {
    return (
      <div
        className={cls}
        style={{ background: "radial-gradient(60% 50% at 30% 0%, rgba(255,45,120,.35), transparent), radial-gradient(50% 40% at 80% 0%, rgba(34,211,238,.3), transparent)" }}
        aria-hidden
      />
    );
  }
  return (
    <div className={cls} aria-hidden style={{ filter: "blur(60px)" }}>
      <Canvas frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 5] }} gl={{ antialias: false }}>
        <Blobs />
      </Canvas>
    </div>
  );
}
```

> If `@react-three/fiber` + React 19 needs it, confirm the installed versions are React-19-compatible during this task; if the Canvas errors, fall back to the static CSS gradient (the `reduced` branch) for all cases and note it. Keep the import dynamic where used (Step 2).

- [ ] **Step 2: Auth pages** — full aurora backdrop + glass auth card. In `app/login/page.tsx` and `app/signup/page.tsx`, dynamically import Aurora and render it behind a centered `.glass-strong` card:

```tsx
import dynamic from "next/dynamic";
const Aurora = dynamic(() => import("@/components/Aurora"), { ssr: false });
// …in the page: <Aurora variant="full" /> then the existing <main> wrapped in a glass card
```

Restyle `AuthForm` inputs/button to token neon styles (glass inputs, magenta-glow submit). Keep all `signIn`/`signUp`/`createProfile` logic + props unchanged. Apply the same glass-card treatment to `onboarding`.

- [ ] **Step 3: Map header echo** — on `app/page.tsx`, render `<Aurora variant="header" />` behind the controls area (dynamic import, contained in a `relative` wrapper so it only tints the top). Keep map/list logic unchanged.

- [ ] **Step 4: Verify + commit** — `tsc` 0, `npm test` 60, `build` 0 (Aurora dynamic → `three` not in initial bundle; confirm build chunks), dev server: `/login` shows the animated aurora behind a glass card; signup/login still work; reduced-motion (emulate) shows the static gradient. Commit:

```bash
git add components/Aurora.tsx app/login/page.tsx app/signup/page.tsx app/onboarding/page.tsx components/auth/AuthForm.tsx app/page.tsx
git commit -m "feat(redesign): three.js aurora showpiece + neon auth pages"
```

---

## Task 8: Profile, friends, feed, leaderboard

**Files:** Modify `components/Avatar.tsx`, `components/profile/*` (`ProfileView`, `BadgeCase`, `FavoriteBars`, `RecentCheckins`, `EditProfileForm`), `components/friends/*`, `app/feed/page.tsx`, `app/leaderboard/page.tsx`, `components/leaderboard/Toggle.tsx`.

**Interfaces:** Consumes `.glass`, `Pill`, `LEVEL_META`, motion variants. No prop/data changes.

- [ ] **Step 1: Avatar glow ring** — add an optional `ring?: boolean` prop to `Avatar` that wraps it in a gradient ring (`cyan→magenta`) + `.glow`; default `false` so existing call sites are unchanged. Use `ring` on the profile header avatar.

- [ ] **Step 2: Profile** — `ProfileView` header in a `.glass` panel with the ringed avatar + neon stat row (Level/points in amber glow); `BadgeCase` tiles get `.glass` + earned-badge glow; `RecentCheckins`/`FavoriteBars` rows use token colors; `EditProfileForm` gets glass inputs + neon save button. Keep all props/data unchanged.

- [ ] **Step 3: Friends** — `/friends` rows in `.glass`, neon Accept (amber) / glass Decline, `UserSearch` results as glass rows with a glowing Add. Keep actions unchanged.

- [ ] **Step 4: Feed** — `/feed` check-in cards as `.glass` with a heat-colored accent dot + `timeAgo`; empty state styled. Keep data unchanged.

- [ ] **Step 5: Leaderboard** — `/leaderboard` rows glassy; rank #1 gets a magenta crown + glow; gradient rank numbers; viewer's row highlighted (amber border + glow); `Toggle` active state neon. Keep scope/window logic unchanged.

- [ ] **Step 6: Verify + commit** — `tsc` 0, `npm test` 60, `build` 0; dev server: walk every page (profile, /u/[username], friends, feed, leaderboard) — all coherent with the neon system, no flat zinc left. Commit:

```bash
git add components/Avatar.tsx components/profile components/friends app/feed/page.tsx app/leaderboard/page.tsx components/leaderboard/Toggle.tsx
git commit -m "feat(redesign): neon profile, friends, feed, leaderboard"
```

---

## Definition of Done

- [ ] Every page reflects the neon-nightlife system (matches the mockup's language); no flat zinc/amber-on-zinc screens remain.
- [ ] `npm test` **60 green** (59 unchanged + the heat-color test); behavior unchanged.
- [ ] `tsc --noEmit` 0; `npm run build` 0 and still builds without `DATABASE_URL`; `three` is lazy (not in the initial/shared bundle).
- [ ] `prefers-reduced-motion` disables Motion + aurora (static fallback); auth/check-in/favorite/friend flows all still work.
- [ ] Crowd-engine files untouched; only `lib/ui.ts` color values changed in `lib/`.

## Self-Review

- **Spec coverage:** tokens §3→T1; primitives/heat meter §3→T2; motion §4→T3; shell→T4; home+map §6→T5; bar detail→T6; aurora §5 + auth→T7; profile/friends/feed/leaderboard §6→T8. Reduced-motion + perf safeguards §5/§8→T1(media query)+T3+T7. Accessibility §8 carried in Global Constraints.
- **Placeholder scan:** foundational tasks (T1–T3, T7 aurora) carry complete code; restyle tasks (T4–T6, T8) give concrete primitive-application + key markup with the approved mockup as the pixel target — appropriate altitude for visual work, no vague "make it nice" directives.
- **Type consistency:** `HeatMeter({ratio, level})` / `Pill({tone})` / `Aurora({variant})` signatures consistent between definition (T2/T7) and use (T5/T6/T7/T8); `LEVEL_META[level].color` used uniformly; no prop changes to existing components (behavior-preserving), only added optional `Avatar.ring`.
