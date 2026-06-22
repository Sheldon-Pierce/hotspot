# Phase 1B — Check-ins & Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user check in to a bar ("I'm here") to earn points and badges, with a pure, tested gamification engine and an atomic check-in write path.

**Architecture:** A pure gamification engine (`lib/gamification/engine.ts`) computes points, level, cooldown, and badge eligibility from plain inputs — fully unit-tested, mirroring `lib/simulation.ts`. A transactional server action (`app/actions/checkin.ts`) orchestrates: cooldown check → insert check-in → write points ledger → bump denormalized profile points → evaluate & award badges, all in one DB transaction. A `CheckInButton` on the bar detail shows points/badges earned. Builds on Phase 0/1A; produces the `checkin` + `points_ledger` + `user_badge` data that Teams C (feed) and D (leaderboards) consume.

**Tech Stack:** Next.js 16 (App Router, modified), React 19, TypeScript, Drizzle ORM, Better Auth, Vitest.

## Global Constraints

- **Modified Next.js 16:** `cookies()`/`headers()` async; route protection is `proxy.ts`. Server actions run on the server; auth via the DAL.
- **Do NOT modify** `app/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, `data/bars.ts`. (Modifying `components/BarDetail.tsx`, `app/page.tsx`, `components/profile/ProfileView.tsx`, `lib/profile/queries.ts` is allowed.)
- **Authoritative auth in the DAL:** the check-in action calls `requireSession()`; never trust a client-supplied user id.
- **Frozen schema** (`lib/db/schema.ts`): write `checkin`, `points_ledger`, `user_badge`; bump `profile.points`. `checkin.id` and `points_ledger.id` are caller-supplied — use `crypto.randomUUID()`. `points_ledger.checkin_id` references the new check-in.
- **Bar IDs** validated against seed `BARS` (`isValidBarId` from `@/lib/favorites`).
- **Locked product decisions:** cooldown = 2h per bar (repeat within window is rejected, not scored); points = +10 per check-in, +15 for a first-ever visit to a new bar; badges awarded on check-in = first-round, explorer-5, explorer-10, regular, night-owl (neighborhood-champ deferred to Leaderboards); honor-system only (no geolocation prompt; `verification` stays `"honor"`); check-in + ledger + badge awards in ONE transaction.
- **Atomicity:** use `db.transaction(async (tx) => …)`; all writes for one check-in go through `tx`.
- **Tests:** Vitest; the engine is pure and fully unit-tested. The action is verified via a throwaway e2e script + dev server.
- **Commits:** small, frequent; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Gamification engine (pure, TDD)

**Files:**
- Create: `lib/gamification/engine.ts`
- Test: `lib/gamification/engine.test.ts`

**Interfaces:**
- Produces (all pure):
  - `POINTS = { checkin: 10, newBar: 15 }`, `COOLDOWN_MS` (2h).
  - `checkinPoints(isNewBar: boolean): { amount: number; reason: string }[]`
  - `levelForPoints(points: number): number`
  - `isWithinCooldown(lastAt: Date | null, now: Date): boolean`
  - `isNightOwlHour(hour: number): boolean`
  - `BadgeStats = { totalCheckins: number; distinctBars: number; maxCheckinsAtOneBar: number; isNightOwl: boolean }`
  - `evaluateBadges(stats: BadgeStats): string[]` — badge keys earned at these stats (keys match `@/lib/gamification/badges`).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/gamification/engine.test.ts
import { describe, it, expect } from "vitest";
import {
  POINTS, COOLDOWN_MS, checkinPoints, levelForPoints,
  isWithinCooldown, isNightOwlHour, evaluateBadges,
} from "@/lib/gamification/engine";

describe("checkinPoints", () => {
  it("awards base only for a repeat bar", () => {
    expect(checkinPoints(false)).toEqual([{ amount: POINTS.checkin, reason: "checkin" }]);
  });
  it("awards base + new-bar bonus for a new bar", () => {
    expect(checkinPoints(true)).toEqual([
      { amount: POINTS.checkin, reason: "checkin" },
      { amount: POINTS.newBar, reason: "new-bar" },
    ]);
  });
});

describe("levelForPoints", () => {
  it("starts at level 1", () => {
    expect(levelForPoints(0)).toBe(1);
    expect(levelForPoints(49)).toBe(1);
  });
  it("levels up on the curve", () => {
    expect(levelForPoints(50)).toBe(2);
    expect(levelForPoints(200)).toBe(3);
  });
});

describe("isWithinCooldown", () => {
  const now = new Date("2026-06-21T12:00:00Z");
  it("is false when there is no prior check-in", () => {
    expect(isWithinCooldown(null, now)).toBe(false);
  });
  it("is true within the window", () => {
    expect(isWithinCooldown(new Date("2026-06-21T11:00:00Z"), now)).toBe(true);
  });
  it("is false past the window", () => {
    expect(isWithinCooldown(new Date("2026-06-21T09:00:00Z"), now)).toBe(false);
  });
});

describe("isNightOwlHour", () => {
  it("is true from midnight to 4am", () => {
    expect(isNightOwlHour(0)).toBe(true);
    expect(isNightOwlHour(3)).toBe(true);
  });
  it("is false otherwise", () => {
    expect(isNightOwlHour(4)).toBe(false);
    expect(isNightOwlHour(12)).toBe(false);
    expect(isNightOwlHour(23)).toBe(false);
  });
});

describe("evaluateBadges", () => {
  it("awards first-round on the first check-in", () => {
    expect(evaluateBadges({ totalCheckins: 1, distinctBars: 1, maxCheckinsAtOneBar: 1, isNightOwl: false }))
      .toEqual(["first-round"]);
  });
  it("awards explorer tiers by distinct bars", () => {
    const r = evaluateBadges({ totalCheckins: 5, distinctBars: 5, maxCheckinsAtOneBar: 1, isNightOwl: false });
    expect(r).toContain("explorer-5");
    expect(r).not.toContain("explorer-10");
  });
  it("awards regular at 10 check-ins at one bar and night-owl when flagged", () => {
    const r = evaluateBadges({ totalCheckins: 12, distinctBars: 10, maxCheckinsAtOneBar: 10, isNightOwl: true });
    expect(r).toEqual(
      expect.arrayContaining(["first-round", "explorer-5", "explorer-10", "regular", "night-owl"]),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/gamification/engine.test.ts`
Expected: FAIL — cannot find module `@/lib/gamification/engine`.

- [ ] **Step 3: Implement the engine**

```ts
// lib/gamification/engine.ts
export const POINTS = { checkin: 10, newBar: 15 } as const;
export const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

export function checkinPoints(isNewBar: boolean): { amount: number; reason: string }[] {
  const entries = [{ amount: POINTS.checkin, reason: "checkin" }];
  if (isNewBar) entries.push({ amount: POINTS.newBar, reason: "new-bar" });
  return entries;
}

/** Level from total points: 1 at 0–49, then a gentle sqrt curve. */
export function levelForPoints(points: number): number {
  return Math.floor(Math.sqrt(Math.max(0, points) / 50)) + 1;
}

/** True if a prior check-in is recent enough to block scoring again. */
export function isWithinCooldown(lastAt: Date | null, now: Date): boolean {
  if (!lastAt) return false;
  return now.getTime() - lastAt.getTime() < COOLDOWN_MS;
}

/** Night Owl window: local hour in [0, 4). */
export function isNightOwlHour(hour: number): boolean {
  return hour >= 0 && hour < 4;
}

export interface BadgeStats {
  totalCheckins: number;
  distinctBars: number;
  maxCheckinsAtOneBar: number;
  isNightOwl: boolean;
}

/** Badge keys earned at these stats. Keys match lib/gamification/badges.ts. */
export function evaluateBadges(s: BadgeStats): string[] {
  const earned: string[] = [];
  if (s.totalCheckins >= 1) earned.push("first-round");
  if (s.distinctBars >= 5) earned.push("explorer-5");
  if (s.distinctBars >= 10) earned.push("explorer-10");
  if (s.maxCheckinsAtOneBar >= 10) earned.push("regular");
  if (s.isNightOwl) earned.push("night-owl");
  return earned;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/gamification/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gamification/engine.ts lib/gamification/engine.test.ts
git commit -m "feat(gamification): pure points/level/cooldown/badge engine"
```

---

## Task 2: Transactional check-in action

**Files:**
- Create: `app/actions/checkin.ts`

**Interfaces:**
- Consumes: `requireSession`, `db`, `checkin`/`pointsLedger`/`profile`/`userBadge` schema, the engine (Task 1), `isValidBarId`, `BADGES`.
- Produces: `checkIn(barId: string): Promise<CheckInResult>` where
  ```ts
  type CheckInResult =
    | { status: "ok"; pointsEarned: number; totalPoints: number; level: number; newBadges: BadgeDef[] }
    | { status: "cooldown" }
    | { status: "error"; message: string };
  ```

- [ ] **Step 1: Implement the check-in action**

```ts
// app/actions/checkin.ts
"use server";

import { and, count, countDistinct, desc, eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { checkin, pointsLedger, profile, userBadge } from "@/lib/db/schema";
import { isValidBarId } from "@/lib/favorites";
import { BADGES, type BadgeDef } from "@/lib/gamification/badges";
import {
  checkinPoints, evaluateBadges, isNightOwlHour, isWithinCooldown, levelForPoints,
} from "@/lib/gamification/engine";

export type CheckInResult =
  | { status: "ok"; pointsEarned: number; totalPoints: number; level: number; newBadges: BadgeDef[] }
  | { status: "cooldown" }
  | { status: "error"; message: string };

/** Local (Pacific) hour for the Night Owl check; bars are in Ballard. */
function pacificHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return Number(h) % 24;
}

export async function checkIn(barId: string): Promise<CheckInResult> {
  const session = await requireSession();
  if (!isValidBarId(barId)) return { status: "error", message: "Unknown bar." };

  const userId = session.user.id;
  const now = new Date();

  return db.transaction(async (tx): Promise<CheckInResult> => {
    // Cooldown: most recent check-in at this bar.
    const last = await tx
      .select({ createdAt: checkin.createdAt })
      .from(checkin)
      .where(and(eq(checkin.userId, userId), eq(checkin.barId, barId)))
      .orderBy(desc(checkin.createdAt))
      .limit(1);
    if (isWithinCooldown(last[0]?.createdAt ?? null, now)) {
      return { status: "cooldown" };
    }

    // Is this the user's first-ever check-in at this bar?
    const priorAtBar = await tx
      .select({ n: count() })
      .from(checkin)
      .where(and(eq(checkin.userId, userId), eq(checkin.barId, barId)));
    const isNewBar = (priorAtBar[0]?.n ?? 0) === 0;

    // Insert the check-in.
    const checkinId = crypto.randomUUID();
    await tx.insert(checkin).values({ id: checkinId, userId, barId });

    // Points ledger + denormalized total.
    const entries = checkinPoints(isNewBar);
    const pointsEarned = entries.reduce((sum, e) => sum + e.amount, 0);
    await tx.insert(pointsLedger).values(
      entries.map((e) => ({
        id: crypto.randomUUID(),
        userId,
        checkinId,
        reason: e.reason,
        amount: e.amount,
      })),
    );
    const updated = await tx
      .update(profile)
      .set({ points: sql`${profile.points} + ${pointsEarned}` })
      .where(eq(profile.userId, userId))
      .returning({ points: profile.points });
    const totalPoints = updated[0]?.points ?? pointsEarned;

    // Stats (including this check-in) for badge evaluation.
    const [totalRow, distinctRow, perBar] = await Promise.all([
      tx.select({ n: count() }).from(checkin).where(eq(checkin.userId, userId)),
      tx.select({ n: countDistinct(checkin.barId) }).from(checkin).where(eq(checkin.userId, userId)),
      tx
        .select({ barId: checkin.barId, n: count() })
        .from(checkin)
        .where(eq(checkin.userId, userId))
        .groupBy(checkin.barId),
    ]);
    const maxAtOneBar = perBar.reduce((m, r) => Math.max(m, Number(r.n)), 0);
    const earnedKeys = evaluateBadges({
      totalCheckins: Number(totalRow[0]?.n ?? 0),
      distinctBars: Number(distinctRow[0]?.n ?? 0),
      maxCheckinsAtOneBar: maxAtOneBar,
      isNightOwl: isNightOwlHour(pacificHour(now)),
    });

    // Award any not-yet-earned badges; report only the newly earned ones.
    const before = await tx
      .select({ key: userBadge.badgeKey })
      .from(userBadge)
      .where(eq(userBadge.userId, userId));
    const had = new Set(before.map((r) => r.key));
    const fresh = earnedKeys.filter((k) => !had.has(k));
    if (fresh.length > 0) {
      await tx
        .insert(userBadge)
        .values(fresh.map((badgeKey) => ({ userId, badgeKey })))
        .onConflictDoNothing();
    }
    const newBadges: BadgeDef[] = BADGES.filter((b) => fresh.includes(b.key));

    return {
      status: "ok",
      pointsEarned,
      totalPoints,
      level: levelForPoints(totalPoints),
      newBadges,
    };
  });
}
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit` (expect clean) and `npm run build` (expect success).

- [ ] **Step 3: End-to-end verification (throwaway script)**

Create `/private/tmp/.../scratchpad/verify-checkin.ts` that signs up a user, inserts a profile row, then calls `checkIn(barId)` twice and asserts: first → `status:"ok"` with `pointsEarned: 25` (new bar) and `newBadges` containing `first-round`; second (immediately) → `status:"cooldown"`. Run with `tsx` and `.env.local` sourced. Expected output confirms ok→cooldown and first-round awarded. (This is a verification step, not a committed test — the engine is unit-tested in Task 1; this proves the transactional wiring against the live DB.)

- [ ] **Step 4: Commit**

```bash
git add app/actions/checkin.ts
git commit -m "feat(checkins): transactional check-in action (points, ledger, badges)"
```

---

## Task 3: Check-in button on bar detail

**Files:**
- Create: `components/CheckInButton.tsx`
- Modify: `components/BarDetail.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `checkIn` action, `useSession`.
- `BarDetail` gains prop `isLoggedIn: boolean`.

- [ ] **Step 1: CheckInButton client component**

```tsx
// components/CheckInButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkIn, type CheckInResult } from "@/app/actions/checkin";

export default function CheckInButton({ barId, isLoggedIn }: { barId: string; isLoggedIn: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  async function onClick() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setPending(true);
    try {
      const r = await checkIn(barId);
      setResult(r);
      if (r.status === "ok") router.refresh(); // reflect new points/badges elsewhere
    } catch {
      setResult({ status: "error", message: "Check-in failed. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={onClick}
        disabled={pending}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "Checking in…" : "📍 I'm here — check in"}
      </button>
      {result?.status === "ok" && (
        <p className="mt-2 text-center text-sm text-emerald-300">
          +{result.pointsEarned} points! (level {result.level})
          {result.newBadges.length > 0 &&
            ` · New badge${result.newBadges.length > 1 ? "s" : ""}: ${result.newBadges
              .map((b) => `${b.icon} ${b.name}`)
              .join(", ")}`}
        </p>
      )}
      {result?.status === "cooldown" && (
        <p className="mt-2 text-center text-sm text-zinc-400">
          You already checked in here recently.
        </p>
      )}
      {result?.status === "error" && (
        <p className="mt-2 text-center text-sm text-red-400">{result.message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render CheckInButton in BarDetail**

In `components/BarDetail.tsx`: add `isLoggedIn` to the props interface and the destructure (alongside the existing `isFavorite`/`onToggleFavorite` from Phase 1A), import the button, and render it. Update the interface:

```tsx
interface BarDetailProps {
  status: BarStatus;
  isFavorite: boolean;
  isLoggedIn: boolean;
  onToggleFavorite: (barId: string) => void;
  onClose: () => void;
}
```

Update the destructure line:

```tsx
export default function BarDetail({ status, isFavorite, isLoggedIn, onToggleFavorite, onClose }: BarDetailProps) {
```

Add the import at the top:

```tsx
import CheckInButton from "@/components/CheckInButton";
```

Render the button just before the website link block (after the menu `</section>`, before the `{bar.website ? (` block):

```tsx
        <CheckInButton barId={bar.id} isLoggedIn={isLoggedIn} />
```

- [ ] **Step 3: Pass isLoggedIn from the page**

In `app/page.tsx`: the `useFavorites()` hook already exposes `isLoggedIn`. Destructure it and pass to `BarDetail`. Change:

```tsx
  const { favorites, toggle } = useFavorites();
```

to:

```tsx
  const { favorites, toggle, isLoggedIn } = useFavorites();
```

and update the `BarDetail` usage to add the prop:

```tsx
        <BarDetail
          status={selected}
          isFavorite={favorites.has(selected.bar.id)}
          isLoggedIn={isLoggedIn}
          onToggleFavorite={toggle}
          onClose={() => setSelectedId(null)}
        />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (clean), `npm run build` (success). Dev server: logged out → check-in button routes to `/login`; logged in → first check-in shows "+25 points!" and a new badge, immediate second shows the cooldown message; `/profile` shows the increased points and the earned badge.

- [ ] **Step 5: Commit**

```bash
git add components/CheckInButton.tsx components/BarDetail.tsx app/page.tsx
git commit -m "feat(checkins): I'm-here check-in button on bar detail"
```

---

## Task 4: Surface check-in stats + level on the profile

**Files:**
- Modify: `lib/profile/queries.ts` (add `getCheckinSummary`)
- Modify: `components/profile/ProfileView.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/u/[username]/page.tsx`

**Interfaces:**
- Produces: `getCheckinSummary(userId: string): Promise<{ totalCheckins: number; distinctBars: number }>` (`@/lib/profile/queries`).
- `ProfileView` gains prop `checkins: { totalCheckins: number; distinctBars: number }`.

- [ ] **Step 1: Add the summary query**

Append to `lib/profile/queries.ts` (it already imports `db`, `eq`, and `checkin` is in the schema — add `checkin` to the existing schema import and `count`/`countDistinct` to the drizzle import):

```ts
// add to the existing import from "drizzle-orm":  import { eq, count, countDistinct } from "drizzle-orm";
// add `checkin` to the existing import from "@/lib/db/schema".

export async function getCheckinSummary(
  userId: string,
): Promise<{ totalCheckins: number; distinctBars: number }> {
  const [total, distinct] = await Promise.all([
    db.select({ n: count() }).from(checkin).where(eq(checkin.userId, userId)),
    db.select({ n: countDistinct(checkin.barId) }).from(checkin).where(eq(checkin.userId, userId)),
  ]);
  return {
    totalCheckins: Number(total[0]?.n ?? 0),
    distinctBars: Number(distinct[0]?.n ?? 0),
  };
}
```

- [ ] **Step 2: Show check-ins + level in ProfileView**

In `components/profile/ProfileView.tsx`: import `levelForPoints`, add the `checkins` prop, and add stats to the stat row. Update the props interface to add:

```tsx
  checkins: { totalCheckins: number; distinctBars: number };
```

Add the import:

```tsx
import { levelForPoints } from "@/lib/gamification/engine";
```

Replace the stat row block:

```tsx
      <div className="flex flex-wrap gap-6 text-sm">
        <span className="text-amber-400">
          <span className="font-bold tabular-nums">{profile.points}</span> points
        </span>
        <span className="text-zinc-400">
          <span className="font-bold tabular-nums text-zinc-200">{favoriteBarIds.length}</span> favorites
        </span>
        <span className="text-zinc-500">Member since {memberSince}</span>
      </div>
```

with:

```tsx
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="text-amber-400">
          Level <span className="font-bold tabular-nums">{levelForPoints(profile.points)}</span>
        </span>
        <span className="text-amber-400">
          <span className="font-bold tabular-nums">{profile.points}</span> points
        </span>
        <span className="text-zinc-400">
          <span className="font-bold tabular-nums text-zinc-200">{checkins.totalCheckins}</span> check-ins
        </span>
        <span className="text-zinc-400">
          <span className="font-bold tabular-nums text-zinc-200">{checkins.distinctBars}</span> bars visited
        </span>
        <span className="text-zinc-400">
          <span className="font-bold tabular-nums text-zinc-200">{favoriteBarIds.length}</span> favorites
        </span>
        <span className="text-zinc-500">Member since {memberSince}</span>
      </div>
```

- [ ] **Step 3: Pass checkins from both profile pages**

In `app/profile/page.tsx`, import `getCheckinSummary` and include it; pass `checkins`:

```tsx
import { getEarnedBadges, getFavoriteBarIds, getCheckinSummary } from "@/lib/profile/queries";
```

```tsx
  const [badges, favoriteBarIds, checkins] = await Promise.all([
    getEarnedBadges(session.user.id),
    getFavoriteBarIds(session.user.id),
    getCheckinSummary(session.user.id),
  ]);

  return (
    <ProfileView
      profile={profile}
      badges={badges}
      favoriteBarIds={favoriteBarIds}
      checkins={checkins}
      isOwner
    />
  );
```

In `app/u/[username]/page.tsx`, do the same — add `getCheckinSummary(profile.userId)` to the `Promise.all` and pass `checkins`:

```tsx
import {
  getProfileByUsername, getEarnedBadges, getFavoriteBarIds, getCheckinSummary,
} from "@/lib/profile/queries";
```

```tsx
  const [badges, favoriteBarIds, session, checkins] = await Promise.all([
    getEarnedBadges(profile.userId),
    getFavoriteBarIds(profile.userId),
    getSession(),
    getCheckinSummary(profile.userId),
  ]);
  const isOwner = session?.user?.id === profile.userId;

  return (
    <ProfileView
      profile={profile}
      badges={badges}
      favoriteBarIds={favoriteBarIds}
      checkins={checkins}
      isOwner={isOwner}
    />
  );
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` (clean), `npm test` (all pass), `npm run build` (success). Dev server: after a check-in, `/profile` shows Level, check-ins count, and bars-visited.

```bash
git add lib/profile/queries.ts components/profile/ProfileView.tsx app/profile/page.tsx "app/u/[username]/page.tsx"
git commit -m "feat(profile): show level, check-ins, and bars-visited"
```

---

## Definition of Done

- [ ] `npm test` passes (engine unit tests + existing).
- [ ] `npm run build` succeeds; `tsc --noEmit` clean.
- [ ] Logged-in user can check in; first check-in at a new bar earns 25 points and the first-round badge; an immediate repeat is rejected (cooldown); points/level/badges/check-in counts appear on `/profile`.
- [ ] Logged-out check-in routes to `/login`.
- [ ] Check-in + points ledger + badge awards are atomic (one transaction).
- [ ] Crowd engine files untouched.

## Hand-off to Teams C & D

`checkin` rows (with `createdAt`, `barId`, `userId`) and `points_ledger` rows (with `amount`, `createdAt`, `reason`) are now being written. Team C (feed) reads `checkin`; Team D (leaderboards) aggregates `points_ledger` over time windows. `neighborhood-champ` badge is intentionally unawarded here — Team D awards it from bar leaderboards.

## Self-Review

- **Spec coverage (spec §7 Gamification + Check-ins):** check-in action ✅(T2), cooldown ✅(T1 engine + T2 enforcement), points + new-bar bonus ✅(T1,T2), level curve ✅(T1, shown T4), badges awarded ✅(T2 via T1 eval), check-in UI ✅(T3), atomic transaction ✅(T2), honor-only/no-geo ✅(constraints, `verification` left default). neighborhood-champ deferred to D (noted). Streaks intentionally omitted (no seeded badge).
- **Placeholder scan:** none — engine + action have complete code; T2 Step 3 is a verification step (engine itself is unit-tested in T1).
- **Type consistency:** `BadgeStats`/`evaluateBadges`/`checkinPoints`/`levelForPoints` defined in T1 and consumed in T2/T4; `CheckInResult` defined in T2 and consumed in T3; `getCheckinSummary` shape consistent between T4 query and the two pages; `isLoggedIn` prop threaded page→BarDetail→CheckInButton.
