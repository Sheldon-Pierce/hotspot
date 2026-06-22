# Phase 1D — Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friend and neighborhood (global) leaderboards over time windows, ranked from the points ledger, plus awarding the final deferred badge (Neighborhood Champ).

**Architecture:** A pure window helper (`lib/leaderboard/window.ts`, TDD) + a server query (`lib/leaderboard/queries.ts`) that aggregates `points_ledger.amount` grouped by user, filtered by scope (friends via `getFriendIds`, or everyone) and window (rolling 7 days or all-time). The `/leaderboard` page reads `searchParams` (Next 16 async) for scope/window. Neighborhood Champ is awarded inside the existing check-in transaction when a check-in makes the user the all-time #1. Completes Phase 1.

**Tech Stack:** Next.js 16 (App Router, modified), React 19, TypeScript, Drizzle ORM, Better Auth, Vitest.

## Global Constraints

- **Modified Next.js 16:** page `searchParams` and dynamic `params` are async (`await`); `cookies()`/`headers()` async; route protection `proxy.ts`.
- **Do NOT modify** `app/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, `data/bars.ts`. (Modifying `lib/gamification/engine.ts`, `lib/gamification/engine.test.ts`, `lib/checkins/record.ts`, `components/auth/UserMenu.tsx`, `proxy.ts` is allowed and expected.)
- **Authoritative auth in the DAL:** the page calls `requireSession()`; never trust a client-supplied id.
- **Frozen schema:** aggregate `points_ledger` (`userId, amount, createdAt`); join `profile` for display. Reuse `getFriendIds` from `@/lib/friends/queries`.
- **server-only split:** pure helpers (window math, types) live in a non-`server-only` file so Vitest can import them; DB queries live in a `server-only` file (mirror `engine.ts` vs `record.ts`).
- **Locked decisions:** windows = `week` (rolling last 7 days) / `all` (all-time); scopes = `friends` (viewer + accepted friends) / `neighborhood` (everyone); leaderboard ranked by summed ledger points desc, top 50; Neighborhood Champ awarded when a check-in makes the user the all-time #1 by total points (ties → all leaders earn it; permanent once earned).
- **Path alias** `@/*`. **Theme** dark amber/zinc. **Commits:** small; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Window helper + leaderboard query

**Files:**
- Create: `lib/leaderboard/window.ts`
- Test: `lib/leaderboard/window.test.ts`
- Create: `lib/leaderboard/queries.ts`

**Interfaces:**
- Produces (`@/lib/leaderboard/window`, pure):
  - `type LeaderboardScope = "friends" | "neighborhood"`
  - `type LeaderboardWindow = "week" | "all"`
  - `interface LeaderboardRow { userId: string; username: string; displayName: string; avatarUrl: string | null; points: number; rank: number }`
  - `windowStart(window: LeaderboardWindow, now: Date): Date | null` (null = all-time)
- Produces (`@/lib/leaderboard/queries`, server-only):
  - `getLeaderboard(scope: LeaderboardScope, window: LeaderboardWindow, viewerId: string, now: Date): Promise<LeaderboardRow[]>`

- [ ] **Step 1: Write the failing test for windowStart**

```ts
// lib/leaderboard/window.test.ts
import { describe, it, expect } from "vitest";
import { windowStart } from "@/lib/leaderboard/window";

const now = new Date("2026-06-21T12:00:00Z");

describe("windowStart", () => {
  it("returns null for all-time", () => {
    expect(windowStart("all", now)).toBeNull();
  });
  it("returns 7 days ago for the week window", () => {
    expect(windowStart("week", now)?.toISOString()).toBe("2026-06-14T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/leaderboard/window.test.ts`
Expected: FAIL — cannot find module `@/lib/leaderboard/window`.

- [ ] **Step 3: Implement the window helper + types**

```ts
// lib/leaderboard/window.ts
export type LeaderboardScope = "friends" | "neighborhood";
export type LeaderboardWindow = "week" | "all";

export interface LeaderboardRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  rank: number;
}

/** Start of the window, or null for all-time. "week" is a rolling 7 days. */
export function windowStart(window: LeaderboardWindow, now: Date): Date | null {
  if (window === "all") return null;
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/leaderboard/window.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the leaderboard query**

```ts
// lib/leaderboard/queries.ts
import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pointsLedger, profile } from "@/lib/db/schema";
import { getFriendIds } from "@/lib/friends/queries";
import {
  windowStart,
  type LeaderboardScope,
  type LeaderboardWindow,
  type LeaderboardRow,
} from "@/lib/leaderboard/window";

export async function getLeaderboard(
  scope: LeaderboardScope,
  window: LeaderboardWindow,
  viewerId: string,
  now: Date,
): Promise<LeaderboardRow[]> {
  const start = windowStart(window, now);
  const conditions = [];
  if (start) conditions.push(gte(pointsLedger.createdAt, start));
  if (scope === "friends") {
    const ids = [viewerId, ...(await getFriendIds(viewerId))];
    conditions.push(inArray(pointsLedger.userId, ids));
  }

  const pts = sql<number>`sum(${pointsLedger.amount})`;
  const rows = await db
    .select({
      userId: pointsLedger.userId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      points: pts.mapWith(Number),
    })
    .from(pointsLedger)
    .innerJoin(profile, eq(pointsLedger.userId, profile.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(pointsLedger.userId, profile.username, profile.displayName, profile.avatarUrl)
    .orderBy(desc(pts))
    .limit(50);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit` (exit 0) and `npm run build` (exit 0).

- [ ] **Step 7: Integration verification (throwaway script)**

Create `_verify-leaderboard.ts` at the project root; run with `node --conditions=react-server --import tsx ./_verify-leaderboard.ts`. Create three users+profiles A,B,C; insert `points_ledger` rows: A=30 (all within last day), B=20, C=100 but with `createdAt` 10 days ago. Make A and B friends (accepted friendship). Assert:
- `getLeaderboard("neighborhood","all",A,now)` ranks C(100) #1, A(30) #2, B(20) #3.
- `getLeaderboard("neighborhood","week",A,now)` excludes C's old points (C absent or 0) and ranks A #1, B #2.
- `getLeaderboard("friends","all",A,now)` contains only A and B (not C), A #1.
Delete all rows after. Expected: assertions log OK. Then `rm -f _verify-leaderboard.ts`. (Pure window math is unit-tested in Steps 1–4; this proves the aggregation/scope/window SQL against the live DB.)

- [ ] **Step 8: Commit**

```bash
git add lib/leaderboard/window.ts lib/leaderboard/window.test.ts lib/leaderboard/queries.ts
git commit -m "feat(leaderboard): window helper + ledger aggregation query"
```

---

## Task 2: Leaderboard page + toggles + nav

**Files:**
- Create: `app/leaderboard/page.tsx`
- Create: `components/leaderboard/Toggle.tsx`
- Modify: `components/auth/UserMenu.tsx`
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: `requireSession`, `getLeaderboard`, `LeaderboardScope`/`LeaderboardWindow`, `Avatar`.

- [ ] **Step 1: Toggle link group (server component, no client JS needed)**

```tsx
// components/leaderboard/Toggle.tsx
import Link from "next/link";

interface ToggleProps {
  options: { value: string; label: string }[];
  current: string;
  hrefFor: (value: string) => string;
}

export default function Toggle({ options, current, hrefFor }: ToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          className={`rounded-md px-3 py-1 transition-colors ${
            current === o.value
              ? "bg-amber-400 font-semibold text-zinc-950"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Leaderboard page (server, async searchParams)**

```tsx
// app/leaderboard/page.tsx
import { requireSession } from "@/lib/dal";
import { getLeaderboard } from "@/lib/leaderboard/queries";
import type { LeaderboardScope, LeaderboardWindow } from "@/lib/leaderboard/window";
import Avatar from "@/components/Avatar";
import Toggle from "@/components/leaderboard/Toggle";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; window?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const scope: LeaderboardScope = sp.scope === "friends" ? "friends" : "neighborhood";
  const window: LeaderboardWindow = sp.window === "all" ? "all" : "week";

  const rows = await getLeaderboard(scope, window, session.user.id, new Date());

  const href = (next: Partial<{ scope: string; window: string }>) =>
    `/leaderboard?scope=${next.scope ?? scope}&window=${next.window ?? window}`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <div className="flex flex-wrap gap-3">
        <Toggle
          options={[
            { value: "neighborhood", label: "Neighborhood" },
            { value: "friends", label: "Friends" },
          ]}
          current={scope}
          hrefFor={(v) => href({ scope: v })}
        />
        <Toggle
          options={[
            { value: "week", label: "This week" },
            { value: "all", label: "All-time" },
          ]}
          current={window}
          hrefFor={(v) => href({ window: v })}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No points yet. Check in to a bar to get on the board.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.userId}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                r.userId === session.user.id
                  ? "border-amber-500/50 bg-amber-400/10"
                  : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <span className="w-6 shrink-0 text-center font-bold tabular-nums text-zinc-400">
                {r.rank}
              </span>
              <Avatar name={r.displayName} src={r.avatarUrl} size={36} />
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-100">{r.displayName}</span>
                <span className="block truncate text-xs text-zinc-400">@{r.username}</span>
              </div>
              <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-amber-300">
                {r.points}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Add a Leaderboard link to the header menu**

In `components/auth/UserMenu.tsx`, add a `Leaderboard` link alongside Feed/Friends/Profile (logged-in block). Insert after the Friends link:

```tsx
      <Link href="/leaderboard" className="font-medium text-zinc-200">
        Leaderboard
      </Link>
```

- [ ] **Step 4: Protect /leaderboard in the proxy**

In `proxy.ts`, add `/leaderboard` to `protectedRoutes`:

```tsx
const protectedRoutes = ["/profile", "/friends", "/feed", "/leaderboard", "/onboarding"];
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (exit 0), `npm run build` (exit 0). Dev server: logged out → `/leaderboard` redirects to `/login`; logged in → board renders; toggling Neighborhood/Friends and This week/All-time changes the URL and the rows; the viewer's own row is highlighted.

- [ ] **Step 6: Commit**

```bash
git add app/leaderboard/page.tsx components/leaderboard/Toggle.tsx components/auth/UserMenu.tsx proxy.ts
git commit -m "feat(leaderboard): /leaderboard page with scope/window toggles + nav"
```

---

## Task 3: Award the Neighborhood Champ badge

**Files:**
- Modify: `lib/gamification/engine.ts`
- Modify: `lib/gamification/engine.test.ts`
- Modify: `lib/checkins/record.ts`

**Interfaces:**
- `BadgeStats` gains `isNeighborhoodChamp: boolean`; `evaluateBadges` awards `"neighborhood-champ"` when it's true.
- `recordCheckIn` computes `isNeighborhoodChamp` (the user's post-bump total equals the global max profile points) and passes it to `evaluateBadges`.

- [ ] **Step 1: Update the engine test (RED for the new field + case)**

In `lib/gamification/engine.test.ts`, update the three existing `evaluateBadges` cases to include `isNeighborhoodChamp: false`, and add a champ case. Replace the whole `describe("evaluateBadges", ...)` block with:

```ts
describe("evaluateBadges", () => {
  it("awards first-round on the first check-in", () => {
    expect(
      evaluateBadges({ totalCheckins: 1, distinctBars: 1, maxCheckinsAtOneBar: 1, isNightOwl: false, isNeighborhoodChamp: false }),
    ).toEqual(["first-round"]);
  });
  it("awards explorer tiers by distinct bars", () => {
    const r = evaluateBadges({ totalCheckins: 5, distinctBars: 5, maxCheckinsAtOneBar: 1, isNightOwl: false, isNeighborhoodChamp: false });
    expect(r).toContain("explorer-5");
    expect(r).not.toContain("explorer-10");
  });
  it("awards regular at 10 at one bar and night-owl when flagged", () => {
    const r = evaluateBadges({ totalCheckins: 12, distinctBars: 10, maxCheckinsAtOneBar: 10, isNightOwl: true, isNeighborhoodChamp: false });
    expect(r).toEqual(
      expect.arrayContaining(["first-round", "explorer-5", "explorer-10", "regular", "night-owl"]),
    );
  });
  it("awards neighborhood-champ when flagged", () => {
    const r = evaluateBadges({ totalCheckins: 1, distinctBars: 1, maxCheckinsAtOneBar: 1, isNightOwl: false, isNeighborhoodChamp: true });
    expect(r).toContain("neighborhood-champ");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/gamification/engine.test.ts`
Expected: FAIL — `evaluateBadges` doesn't award `neighborhood-champ` (and the type lacks the field).

- [ ] **Step 3: Update engine.ts**

In `lib/gamification/engine.ts`, add the field to `BadgeStats` and the rule to `evaluateBadges`:

```ts
export interface BadgeStats {
  totalCheckins: number;
  distinctBars: number;
  maxCheckinsAtOneBar: number;
  isNightOwl: boolean;
  isNeighborhoodChamp: boolean;
}

export function evaluateBadges(s: BadgeStats): string[] {
  const earned: string[] = [];
  if (s.totalCheckins >= 1) earned.push("first-round");
  if (s.distinctBars >= 5) earned.push("explorer-5");
  if (s.distinctBars >= 10) earned.push("explorer-10");
  if (s.maxCheckinsAtOneBar >= 10) earned.push("regular");
  if (s.isNightOwl) earned.push("night-owl");
  if (s.isNeighborhoodChamp) earned.push("neighborhood-champ");
  return earned;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/gamification/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Compute and pass isNeighborhoodChamp in recordCheckIn**

In `lib/checkins/record.ts`, after the `totalPoints` line and before the stats `Promise.all`, compute the global max; then add `isNeighborhoodChamp` to the `evaluateBadges` call. Insert after `const totalPoints = updated[0]?.points ?? pointsEarned;`:

```ts
    // All-time #1 by total points → Neighborhood Champ (ties: all leaders earn it).
    const maxRow = await tx.select({ max: sql<number>`max(${profile.points})` }).from(profile);
    const isNeighborhoodChamp = totalPoints > 0 && totalPoints >= Number(maxRow[0]?.max ?? 0);
```

And update the `evaluateBadges({...})` call to include the new field:

```ts
    const earnedKeys = evaluateBadges({
      totalCheckins: Number(totalRow[0]?.n ?? 0),
      distinctBars: Number(distinctRow[0]?.n ?? 0),
      maxCheckinsAtOneBar: maxAtOneBar,
      isNightOwl: isNightOwlHour(pacificHour(now)),
      isNeighborhoodChamp,
    });
```

> `sql` and `profile` are already imported in `record.ts`. The `profile` points were bumped earlier in this same transaction, so `max(profile.points)` reflects this check-in.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (exit 0), `npm test` (all pass), `npm run build` (exit 0).

- [ ] **Step 7: Integration verification (throwaway script)**

Create `_verify-champ.ts` at the project root; run with `node --conditions=react-server --import tsx ./_verify-champ.ts`. Create user A+profile (points 0); call `recordCheckIn(A, validBar, now)`; since A is now the only/highest scorer, assert the result's `newBadges` includes `neighborhood-champ` (and `first-round`). Then create user B and give B more points than A (e.g., insert a profile with points 9999); call `recordCheckIn(A, anotherBar, now+3h)` — assert A does NOT earn champ again (already has it; `newBadges` won't include it) and that A is no longer the max. Delete rows after. Then `rm -f _verify-champ.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/gamification/engine.ts lib/gamification/engine.test.ts lib/checkins/record.ts
git commit -m "feat(gamification): award Neighborhood Champ to the all-time #1"
```

---

## Definition of Done

- [ ] `npm test` passes (window + engine + existing).
- [ ] `npm run build` exit 0; `tsc --noEmit` exit 0.
- [ ] `/leaderboard` shows neighborhood + friends boards over week/all-time; viewer's row highlighted; logged-out redirects to `/login`.
- [ ] A check-in that makes a user the all-time #1 awards Neighborhood Champ (once, permanent).
- [ ] Header has a Leaderboard link.
- [ ] Crowd engine files untouched.

## Phase 1 Complete

With Leaderboards, all four Phase 1 features (Profiles+Favorites, Check-ins+Gamification, Friends+Feed, Leaderboards) are shipped on top of the Phase 0 foundation. All six seeded badges are now awardable.

## Self-Review

- **Spec coverage (spec §7 Leaderboards):** friend + neighborhood scopes ✅(T1,T2), week/all-time windows ✅(T1,T2), ranked from points ledger ✅(T1), `/leaderboard` UI ✅(T2), neighborhood-champ award ✅(T3). Reuses `getFriendIds` (friends scope) and `points_ledger` (Phase 1B) as planned.
- **Placeholder scan:** none — all code complete; T1 Step 7 + T3 Step 7 are verification, the pure `windowStart` + `evaluateBadges` champ rule are unit-tested.
- **Type consistency:** `LeaderboardScope`/`LeaderboardWindow`/`LeaderboardRow` defined in `window.ts` (T1) and consumed by `queries.ts` (T1) + the page (T2); `windowStart` signature consistent; `BadgeStats` gains `isNeighborhoodChamp` in T3 and every `evaluateBadges` caller (engine test + `record.ts`) is updated in the same task.
