# Phase 1A — Profiles & Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user star/unstar favorite bars (pinned in the list) and view/edit a real profile (avatar, bio, points, badge case, favorites) at `/profile`, with a public view at `/u/[username]`.

**Architecture:** Builds on the Phase 0 frozen schema and DAL. Favorites use a server action + a `GET /api/favorites` route consumed by a client `useFavorites` hook that the existing map/list page wires in. Profiles are server-rendered from new query helpers; a shared `ProfileView` renders both the owner and public views. Avatars are generated (initials + deterministic color) with an optional image-URL override — no file uploads in v1.

**Tech Stack:** Next.js 16 (App Router, modified), React 19, TypeScript, Tailwind 4, Drizzle ORM, Better Auth, Zod 4, Vitest.

## Global Constraints

- **Modified Next.js 16:** dynamic route `params` are async — `const { username } = await params`. `cookies()`/`headers()` async. Route protection is `proxy.ts` (already present).
- **Do NOT modify** `app/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, `data/bars.ts`. (Modifying `components/BarList.tsx`, `components/BarDetail.tsx`, `app/page.tsx` IS allowed and expected.)
- **Authoritative auth in the DAL:** every server action / route / page that touches user data calls `requireSession()`/`getSession()` from `@/lib/dal`. The proxy is optimistic only.
- **Path alias** `@/*` → project root. **Bar IDs** are the string ids in `data/bars.ts` (validate against `BARS`).
- **Frozen schema** (`lib/db/schema.ts`): use `profile`, `favorite`, `userBadge` as defined. `BADGES` catalog from `@/lib/gamification/badges`.
- **Tests:** Vitest (`npm test`); pure functions get unit tests. UI/data-layer verified via `npm run build` + dev-server checks.
- **Theme:** existing dark amber/zinc palette (see `components/Header.tsx`, `BarDetail.tsx`).
- **Independence:** do NOT depend on check-ins/friends (Teams B/C). The badge case shows earned badges (empty until Team B awards them); profile stats shown are points + favorites count + member-since only.
- **Commits:** small, frequent; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Avatar utilities + component

**Files:**
- Create: `lib/profile/avatar.ts`
- Test: `lib/profile/avatar.test.ts`
- Create: `components/Avatar.tsx`

**Interfaces:**
- Produces: `avatarColor(seed: string): string` (an `hsl(...)` string), `initials(name: string): string`; `Avatar` React component `({ name, src, size }: { name: string; src?: string | null; size?: number })`.

- [ ] **Step 1: Write failing tests**

```ts
// lib/profile/avatar.test.ts
import { describe, it, expect } from "vitest";
import { avatarColor, initials } from "@/lib/profile/avatar";

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("sheldon")).toBe(avatarColor("sheldon"));
  });
  it("returns an hsl() string", () => {
    expect(avatarColor("sheldon")).toMatch(/^hsl\(/);
  });
});

describe("initials", () => {
  it("takes first+last initials of a two-word name", () => {
    expect(initials("Sheldon Pierce")).toBe("SP");
  });
  it("takes first two letters of a single word", () => {
    expect(initials("madonna")).toBe("MA");
  });
  it("returns ? for empty input", () => {
    expect(initials("   ")).toBe("?");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/profile/avatar.test.ts`
Expected: FAIL — cannot find module `@/lib/profile/avatar`.

- [ ] **Step 3: Implement utilities**

```ts
// lib/profile/avatar.ts
/** Deterministic pleasant color from any seed string. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 45%)`;
}

/** 1–2 uppercase initials from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/profile/avatar.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Implement the Avatar component**

```tsx
// components/Avatar.tsx
import { avatarColor, initials } from "@/lib/profile/avatar";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number; // px
}

export default function Avatar({ name, src, size = 40 }: AvatarProps) {
  const dimension = { width: size, height: size, fontSize: size * 0.4 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user avatar URL, not a known asset
    return (
      <img
        src={src}
        alt={name}
        style={dimension}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...dimension, backgroundColor: avatarColor(name) }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/profile/avatar.ts lib/profile/avatar.test.ts components/Avatar.tsx
git commit -m "feat(profile): avatar utilities + Avatar component"
```

---

## Task 2: Favorites data layer

**Files:**
- Create: `lib/favorites.ts`
- Test: `lib/favorites.test.ts`
- Create: `app/actions/favorites.ts`
- Create: `app/api/favorites/route.ts`

**Interfaces:**
- Produces:
  - `isValidBarId(id: string): boolean`, `barName(id: string): string | null` (`@/lib/favorites`).
  - `toggleFavorite(barId: string): Promise<{ favorited: boolean }>` server action (`@/app/actions/favorites`) — auth-gated; throws on unknown bar.
  - `GET /api/favorites` → `{ favorites: string[] }` (current user's favorite barIds; `[]` if logged out).

- [ ] **Step 1: Write failing tests for bar-id helpers**

```ts
// lib/favorites.test.ts
import { describe, it, expect } from "vitest";
import { isValidBarId, barName } from "@/lib/favorites";
import { BARS } from "@/data/bars";

describe("isValidBarId", () => {
  it("accepts a real seed bar id", () => {
    expect(isValidBarId(BARS[0].id)).toBe(true);
  });
  it("rejects an unknown id", () => {
    expect(isValidBarId("not-a-real-bar")).toBe(false);
  });
});

describe("barName", () => {
  it("returns the name for a real id", () => {
    expect(barName(BARS[0].id)).toBe(BARS[0].name);
  });
  it("returns null for an unknown id", () => {
    expect(barName("not-a-real-bar")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/favorites.test.ts`
Expected: FAIL — cannot find module `@/lib/favorites`.

- [ ] **Step 3: Implement the helpers**

```ts
// lib/favorites.ts
import { BARS } from "@/data/bars";

const BAR_IDS = new Set(BARS.map((b) => b.id));

export function isValidBarId(id: string): boolean {
  return BAR_IDS.has(id);
}

export function barName(id: string): string | null {
  return BARS.find((b) => b.id === id)?.name ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/favorites.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the toggle server action**

```ts
// app/actions/favorites.ts
"use server";

import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { favorite } from "@/lib/db/schema";
import { isValidBarId } from "@/lib/favorites";

export async function toggleFavorite(barId: string): Promise<{ favorited: boolean }> {
  const session = await requireSession();
  if (!isValidBarId(barId)) throw new Error("Unknown bar");

  const where = and(eq(favorite.userId, session.user.id), eq(favorite.barId, barId));
  const existing = await db.select({ barId: favorite.barId }).from(favorite).where(where).limit(1);

  if (existing.length > 0) {
    await db.delete(favorite).where(where);
    return { favorited: false };
  }
  await db.insert(favorite).values({ userId: session.user.id, barId });
  return { favorited: true };
}
```

- [ ] **Step 6: Implement the GET route**

```ts
// app/api/favorites/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { favorite } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ favorites: [] });
  const rows = await db
    .select({ barId: favorite.barId })
    .from(favorite)
    .where(eq(favorite.userId, session.user.id));
  return NextResponse.json({ favorites: rows.map((r) => r.barId) });
}
```

- [ ] **Step 7: Verify build + commit**

Run: `npm run build` (expect success). Then:

```bash
git add lib/favorites.ts lib/favorites.test.ts app/actions/favorites.ts app/api/favorites/route.ts
git commit -m "feat(favorites): bar-id helpers, toggle action, and GET /api/favorites"
```

---

## Task 3: Favorites UI integration

**Files:**
- Create: `lib/useFavorites.ts`
- Modify: `components/BarList.tsx`
- Modify: `components/BarDetail.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `toggleFavorite` action, `GET /api/favorites`, `useSession`.
- Produces: `useFavorites(): { favorites: Set<string>; toggle: (barId: string) => void; isLoggedIn: boolean }`.
- `BarList` gains props `favorites: Set<string>` and `onToggleFavorite: (barId: string) => void`.
- `BarDetail` gains props `isFavorite: boolean` and `onToggleFavorite: (barId: string) => void`.

- [ ] **Step 1: Implement the useFavorites hook**

```ts
// lib/useFavorites.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { toggleFavorite } from "@/app/actions/favorites";

export function useFavorites() {
  const { data: session } = useSession();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    if (!isLoggedIn) {
      setFavorites(new Set());
      return;
    }
    let cancelled = false;
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((b: { favorites: string[] }) => {
        if (!cancelled) setFavorites(new Set(b.favorites));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const flip = (set: Set<string>, barId: string) => {
    const next = new Set(set);
    if (next.has(barId)) next.delete(barId);
    else next.add(barId);
    return next;
  };

  const toggle = useCallback(
    async (barId: string) => {
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }
      setFavorites((prev) => flip(prev, barId)); // optimistic
      try {
        await toggleFavorite(barId);
      } catch {
        setFavorites((prev) => flip(prev, barId)); // revert on error
      }
    },
    [isLoggedIn, router],
  );

  return { favorites, toggle, isLoggedIn };
}
```

- [ ] **Step 2: Add a favorite star to BarList (pin favorites first)**

In `components/BarList.tsx`: update the props interface and `sortBars`, and add a star button. Replace the file's contents with:

```tsx
"use client";

import type { BarStatus } from "@/lib/types";
import { LEVEL_META, TREND_META } from "@/lib/ui";

interface BarListProps {
  bars: BarStatus[];
  favorites: Set<string>;
  onSelect: (barId: string) => void;
  onToggleFavorite: (barId: string) => void;
}

/** Favorites first, then open busiest-first, closed at the bottom. */
function sortBars(bars: BarStatus[], favorites: Set<string>): BarStatus[] {
  return [...bars].sort((a, b) => {
    const af = favorites.has(a.bar.id);
    const bf = favorites.has(b.bar.id);
    if (af !== bf) return af ? -1 : 1;
    if (a.open !== b.open) return a.open ? -1 : 1;
    return b.ratio - a.ratio;
  });
}

export default function BarList({ bars, favorites, onSelect, onToggleFavorite }: BarListProps) {
  return (
    <ul className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-4">
      {sortBars(bars, favorites).map((status) => {
        const { bar } = status;
        const meta = LEVEL_META[status.level];
        const trendMeta = TREND_META[status.trend];
        const incentive = status.deals.find((d) => d.type === "incentive");
        const fav = favorites.has(bar.id);
        return (
          <li key={bar.id} className="relative">
            <button
              onClick={() => onSelect(bar.id)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-colors hover:border-zinc-600"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="truncate font-semibold text-zinc-100">{bar.name}</span>
                {incentive && (
                  <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    🎁 {incentive.title}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-sm tabular-nums text-zinc-300">
                  {status.open ? (
                    <>
                      <span className="font-semibold text-zinc-100">{status.count}</span>
                      <span className="text-zinc-500"> / {bar.capacity}</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">Closed</span>
                  )}
                </span>
              </div>

              {status.open && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, status.ratio * 100)}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-xs text-zinc-400">
                    {meta.label} {trendMeta.icon} {trendMeta.label}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => onToggleFavorite(bar.id)}
              className="absolute right-3 top-3 rounded-full p-1 text-lg leading-none"
              aria-label={fav ? `Unfavorite ${bar.name}` : `Favorite ${bar.name}`}
              aria-pressed={fav}
            >
              <span className={fav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}>
                {fav ? "★" : "☆"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

> Note: the star sits absolutely positioned over the card so it isn't nested inside the selabel button (nested buttons are invalid HTML). The count/ratio block already sits left of it with `mr` spacing via the card padding; the absolute star overlaps the top-right corner where there is whitespace.

- [ ] **Step 3: Add a favorite button to BarDetail**

In `components/BarDetail.tsx`, update the props and add a star button next to the title. Change the interface and the header block:

Replace:

```tsx
interface BarDetailProps {
  status: BarStatus;
  onClose: () => void;
}

export default function BarDetail({ status, onClose }: BarDetailProps) {
```

with:

```tsx
interface BarDetailProps {
  status: BarStatus;
  isFavorite: boolean;
  onToggleFavorite: (barId: string) => void;
  onClose: () => void;
}

export default function BarDetail({ status, isFavorite, onToggleFavorite, onClose }: BarDetailProps) {
```

And replace the title/close header block:

```tsx
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{bar.name}</h2>
            <p className="text-sm text-zinc-400">{bar.address}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
```

with:

```tsx
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{bar.name}</h2>
            <p className="text-sm text-zinc-400">{bar.address}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleFavorite(bar.id)}
              className="rounded-full p-1 text-xl leading-none"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={isFavorite}
            >
              <span className={isFavorite ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"}>
                {isFavorite ? "★" : "☆"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
```

- [ ] **Step 4: Wire favorites into the home page**

In `app/page.tsx`, import and use the hook, and pass props. Add the import near the others:

```tsx
import { useFavorites } from "@/lib/useFavorites";
```

Inside `Home()`, after the `useBars` line, add:

```tsx
  const { favorites, toggle } = useFavorites();
```

Update the `BarList` usage:

```tsx
          <BarList bars={data.bars} favorites={favorites} onSelect={setSelectedId} onToggleFavorite={toggle} />
```

Update the `BarDetail` usage:

```tsx
        <BarDetail
          status={selected}
          isFavorite={favorites.has(selected.bar.id)}
          onToggleFavorite={toggle}
          onClose={() => setSelectedId(null)}
        />
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (expect clean) and `npm run build` (expect success).
Then start the dev server and confirm: logged out, clicking a star routes to `/login`; logged in, starring pins the bar to the top of the list and persists across reload (GET /api/favorites). Manual:

```bash
npm run dev   # then in the browser: log in, star a bar, reload — it stays starred and pinned
```

- [ ] **Step 6: Commit**

```bash
git add lib/useFavorites.ts components/BarList.tsx components/BarDetail.tsx app/page.tsx
git commit -m "feat(favorites): star/unstar in list + detail, pinned favorites"
```

---

## Task 4: Profile queries + own profile page

**Files:**
- Create: `lib/profile/queries.ts`
- Create: `components/profile/BadgeCase.tsx`
- Create: `components/profile/FavoriteBars.tsx`
- Create: `components/profile/ProfileView.tsx`
- Modify: `app/profile/page.tsx`

**Interfaces:**
- Produces (`@/lib/profile/queries`, server-only):
  - `getProfileByUsername(username: string): Promise<Profile | null>`
  - `getFavoriteBarIds(userId: string): Promise<string[]>`
  - `getEarnedBadges(userId: string): Promise<BadgeDef[]>`
  - where `Profile` is the row type `typeof profile.$inferSelect`.
- `ProfileView({ profile, badges, favoriteBarIds, isOwner }: { profile: Profile; badges: BadgeDef[]; favoriteBarIds: string[]; isOwner: boolean })`.

- [ ] **Step 1: Implement profile queries**

```ts
// lib/profile/queries.ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profile, favorite, userBadge } from "@/lib/db/schema";
import { BADGES, type BadgeDef } from "@/lib/gamification/badges";

export type Profile = typeof profile.$inferSelect;

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const rows = await db.select().from(profile).where(eq(profile.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function getFavoriteBarIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ barId: favorite.barId })
    .from(favorite)
    .where(eq(favorite.userId, userId));
  return rows.map((r) => r.barId);
}

export async function getEarnedBadges(userId: string): Promise<BadgeDef[]> {
  const rows = await db
    .select({ key: userBadge.badgeKey })
    .from(userBadge)
    .where(eq(userBadge.userId, userId));
  const earned = new Set(rows.map((r) => r.key));
  return BADGES.filter((b) => earned.has(b.key));
}
```

- [ ] **Step 2: BadgeCase component**

```tsx
// components/profile/BadgeCase.tsx
import type { BadgeDef } from "@/lib/gamification/badges";

export default function BadgeCase({ badges }: { badges: BadgeDef[] }) {
  if (badges.length === 0) {
    return <p className="text-sm text-zinc-500">No badges yet — check in to a bar to start earning.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-3">
      {badges.map((b) => (
        <li
          key={b.key}
          title={b.description}
          className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
        >
          <span className="text-2xl">{b.icon}</span>
          <span className="text-xs text-zinc-300">{b.name}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: FavoriteBars component**

```tsx
// components/profile/FavoriteBars.tsx
import { barName } from "@/lib/favorites";

export default function FavoriteBars({ barIds }: { barIds: string[] }) {
  const named = barIds.map((id) => ({ id, name: barName(id) })).filter((b) => b.name);
  if (named.length === 0) {
    return <p className="text-sm text-zinc-500">No favorite bars yet.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {named.map((b) => (
        <li
          key={b.id}
          className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-200"
        >
          ★ {b.name}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: ProfileView component (shared by owner + public)**

```tsx
// components/profile/ProfileView.tsx
import Link from "next/link";
import Avatar from "@/components/Avatar";
import BadgeCase from "@/components/profile/BadgeCase";
import FavoriteBars from "@/components/profile/FavoriteBars";
import type { BadgeDef } from "@/lib/gamification/badges";
import type { Profile } from "@/lib/profile/queries";

interface ProfileViewProps {
  profile: Profile;
  badges: BadgeDef[];
  favoriteBarIds: string[];
  isOwner: boolean;
}

export default function ProfileView({ profile, badges, favoriteBarIds, isOwner }: ProfileViewProps) {
  const memberSince = profile.createdAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-4">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-zinc-100">{profile.displayName}</h1>
          <p className="text-zinc-400">@{profile.username}</p>
        </div>
        {isOwner && (
          <Link
            href="/profile/edit"
            className="ml-auto shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
          >
            Edit
          </Link>
        )}
      </header>

      {profile.bio && <p className="text-zinc-300">{profile.bio}</p>}

      <div className="flex gap-6 text-sm">
        <span className="text-amber-400">
          <span className="font-bold tabular-nums">{profile.points}</span> points
        </span>
        <span className="text-zinc-400">
          <span className="font-bold tabular-nums text-zinc-200">{favoriteBarIds.length}</span> favorites
        </span>
        <span className="text-zinc-500">Member since {memberSince}</span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Badges</h2>
        <BadgeCase badges={badges} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Favorite bars</h2>
        <FavoriteBars barIds={favoriteBarIds} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Replace the minimal own-profile page**

```tsx
// app/profile/page.tsx
import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import { getEarnedBadges, getFavoriteBarIds } from "@/lib/profile/queries";
import ProfileView from "@/components/profile/ProfileView";

export default async function ProfilePage() {
  const session = await requireSession();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const [badges, favoriteBarIds] = await Promise.all([
    getEarnedBadges(session.user.id),
    getFavoriteBarIds(session.user.id),
  ]);

  return (
    <ProfileView profile={profile} badges={badges} favoriteBarIds={favoriteBarIds} isOwner />
  );
}
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit` (clean), `npm run build` (success). Manually: log in → `/profile` shows avatar (initials), points, favorites (star a bar first), empty badge case.

```bash
git add lib/profile/queries.ts components/profile/ app/profile/page.tsx
git commit -m "feat(profile): profile queries + full /profile view"
```

---

## Task 5: Public profile page `/u/[username]`

**Files:**
- Create: `app/u/[username]/page.tsx`

**Interfaces:**
- Consumes: `getProfileByUsername`, `getEarnedBadges`, `getFavoriteBarIds`, `getSession`, `ProfileView`.

- [ ] **Step 1: Implement the public profile page**

```tsx
// app/u/[username]/page.tsx
import { notFound } from "next/navigation";
import { getSession } from "@/lib/dal";
import {
  getProfileByUsername,
  getEarnedBadges,
  getFavoriteBarIds,
} from "@/lib/profile/queries";
import ProfileView from "@/components/profile/ProfileView";

// Next 16: route params are async.
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());
  if (!profile) notFound();

  const [badges, favoriteBarIds, session] = await Promise.all([
    getEarnedBadges(profile.userId),
    getFavoriteBarIds(profile.userId),
    getSession(),
  ]);
  const isOwner = session?.user?.id === profile.userId;

  return (
    <ProfileView profile={profile} badges={badges} favoriteBarIds={favoriteBarIds} isOwner={isOwner} />
  );
}
```

> Check-ins are intentionally NOT shown here yet — friend-gated check-in visibility is Team C's work. Public profiles currently expose only public basics (name, bio, points, badges, favorites).

- [ ] **Step 2: Verify + commit**

Run: `npm run build` (success). Manually: visit `/u/<your-username>` → public view renders; `/u/nope` → 404.

```bash
git add "app/u/[username]/page.tsx"
git commit -m "feat(profile): public /u/[username] profile page"
```

---

## Task 6: Edit profile

**Files:**
- Modify: `app/actions/profile.ts` (add `updateProfile`)
- Create: `lib/profile/profile-input.ts`
- Test: `lib/profile/profile-input.test.ts`
- Create: `components/profile/EditProfileForm.tsx`
- Create: `app/profile/edit/page.tsx`

**Interfaces:**
- Produces:
  - `profileEditSchema` (Zod) validating `{ displayName, bio, avatarUrl }` (`@/lib/profile/profile-input`).
  - `updateProfile(prev, formData): Promise<{ error?: string }>` server action — validates, updates the current user's profile, redirects to `/profile`.

- [ ] **Step 1: Write failing tests for the edit schema**

```ts
// lib/profile/profile-input.test.ts
import { describe, it, expect } from "vitest";
import { profileEditSchema } from "@/lib/profile/profile-input";

describe("profileEditSchema", () => {
  it("accepts a display name with empty bio and url", () => {
    const r = profileEditSchema.safeParse({ displayName: "Sheldon", bio: "", avatarUrl: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bio).toBeNull();
      expect(r.data.avatarUrl).toBeNull();
    }
  });
  it("rejects an empty display name", () => {
    expect(profileEditSchema.safeParse({ displayName: "  ", bio: "", avatarUrl: "" }).success).toBe(false);
  });
  it("rejects a non-http avatar url", () => {
    expect(
      profileEditSchema.safeParse({ displayName: "S", bio: "", avatarUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
  it("accepts an https avatar url", () => {
    const r = profileEditSchema.safeParse({ displayName: "S", bio: "hi", avatarUrl: "https://x.com/a.png" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/profile/profile-input.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the edit schema**

```ts
// lib/profile/profile-input.ts
import { z } from "zod";

// Empty strings normalize to null; avatarUrl must be http(s) if provided.
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const profileEditSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(50),
  bio: z.preprocess(emptyToNull, z.string().trim().max(280).nullable()),
  avatarUrl: z.preprocess(
    emptyToNull,
    z
      .string()
      .url("Avatar URL must be a valid URL.")
      .refine((u) => /^https?:\/\//.test(u), "Avatar URL must start with http(s)://")
      .nullable(),
  ),
});

export type ProfileEdit = z.infer<typeof profileEditSchema>;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/profile/profile-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the updateProfile action**

Append to `app/actions/profile.ts`:

```ts
import { profileEditSchema } from "@/lib/profile/profile-input";

export async function updateProfile(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireSession();

  const parsed = profileEditSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    avatarUrl: formData.get("avatarUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db
    .update(profile)
    .set({
      displayName: parsed.data.displayName,
      bio: parsed.data.bio,
      avatarUrl: parsed.data.avatarUrl,
    })
    .where(eq(profile.userId, session.user.id));

  redirect("/profile");
}
```

> `redirect`, `eq`, `db`, `profile`, `requireSession` are already imported at the top of `app/actions/profile.ts` from Task 6 of Phase 0. Only the `profileEditSchema` import is new.

- [ ] **Step 6: EditProfileForm component**

```tsx
// components/profile/EditProfileForm.tsx
"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import type { Profile } from "@/lib/profile/queries";

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-zinc-400">Display name</label>
      <input
        name="displayName"
        defaultValue={profile.displayName}
        required
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <label className="text-sm text-zinc-400">Bio</label>
      <textarea
        name="bio"
        defaultValue={profile.bio ?? ""}
        rows={3}
        maxLength={280}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <label className="text-sm text-zinc-400">Avatar URL (optional)</label>
      <input
        name="avatarUrl"
        defaultValue={profile.avatarUrl ?? ""}
        placeholder="https://…"
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="rounded bg-amber-400 px-3 py-2 font-medium text-zinc-950 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Edit page**

```tsx
// app/profile/edit/page.tsx
import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import EditProfileForm from "@/components/profile/EditProfileForm";

export default async function EditProfilePage() {
  await requireSession();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Edit profile</h1>
      <EditProfileForm profile={profile} />
    </main>
  );
}
```

- [ ] **Step 8: Verify + commit**

Run: `npx tsc --noEmit` (clean), `npm test` (all pass), `npm run build` (success). Manually: `/profile/edit` → change display name + bio + paste an https image url → Save → `/profile` reflects changes; `/profile/edit` is gated when logged out (proxy: add `/profile` already covers `/profile/edit` via `startsWith`).

```bash
git add app/actions/profile.ts lib/profile/profile-input.ts lib/profile/profile-input.test.ts components/profile/EditProfileForm.tsx app/profile/edit/page.tsx
git commit -m "feat(profile): edit profile (display name, bio, avatar url)"
```

---

## Definition of Done

- [ ] `npm test` passes (avatar, favorites, profile-input unit tests + existing).
- [ ] `npm run build` succeeds; `tsc --noEmit` clean.
- [ ] Logged-in user can star/unstar bars; favorites pin to the top of the list and persist across reload; logged-out star routes to `/login`.
- [ ] `/profile` shows avatar, points, favorites, and badge case; `/profile/edit` updates display name/bio/avatar URL.
- [ ] `/u/[username]` renders a public profile; unknown username → 404.
- [ ] Crowd engine files untouched (`api/bars`, `simulation`, `deals`, `presets`, `data/bars`).

## Self-Review

- **Spec coverage (spec §7 Profiles/Favorites):** profile view ✅(T4), edit ✅(T6), public `/u/[username]` ✅(T5), favorites star + list pinning ✅(T2,T3), avatar ✅(T1), badge case ✅(T4). Check-in stats & friend-gated check-in visibility intentionally deferred to Teams B/C (noted in T5).
- **Placeholder scan:** none — every code step has complete code; verification steps name exact commands.
- **Type consistency:** `Profile` (`typeof profile.$inferSelect`) defined in T4 and reused in T6 components; `toggle`/`favorites`/`onToggleFavorite` names consistent across `useFavorites` (T3), `BarList`/`BarDetail` (T3), `page.tsx` (T3); `BadgeDef` imported from the Phase 0 catalog.
