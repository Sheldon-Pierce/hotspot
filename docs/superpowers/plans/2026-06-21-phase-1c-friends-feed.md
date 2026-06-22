# Phase 1C — Friends & Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mutual friendships (request → accept/decline → unfriend), user search, a friends-only check-in feed at `/feed`, and friend-gated check-in visibility on public profiles.

**Architecture:** A friends data layer (`lib/friends/queries.ts`, server-only) reads friendships/feed; mutations are server actions (`app/actions/friends.ts`). Because `friendship` is one-row-per-pair with no canonical ordering (Phase 0 hand-off), every relationship check queries BOTH directions `(a,b) OR (b,a)`. The feed and profile check-in lists reuse `getFriendIds`. Builds on Phase 0/1A/1B; reads the `checkin` rows Phase 1B writes.

**Tech Stack:** Next.js 16 (App Router, modified), React 19, TypeScript, Drizzle ORM, Better Auth, Vitest.

## Global Constraints

- **Modified Next.js 16:** dynamic route `params` async; `cookies()`/`headers()` async; route protection `proxy.ts` (already protects `/friends` and `/feed`).
- **Do NOT modify** `app/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, `data/bars.ts`. (Modifying `app/u/[username]/page.tsx`, `components/profile/ProfileView.tsx`, `components/auth/UserMenu.tsx` is allowed.)
- **Authoritative auth in the DAL:** every action/route/page calls `requireSession()`/`getSession()`; never trust a client-supplied "me" id — `me` is always `session.user.id`.
- **Friendship is one-row-per-pair, no canonical ordering** — all "are A and B friends?" / friend-list / unfriend logic must check both `(requester,addressee)` orderings.
- **Frozen schema:** `friendship` (`requesterId, addresseeId, status: "pending"|"accepted", createdAt`, PK `(requesterId,addresseeId)`); read `checkin`, `profile`. Bar names via `barName` from `@/lib/favorites`.
- **Path alias** `@/*` → root. **Privacy:** check-ins are friends-only — a non-friend viewing `/u/[username]` must NOT see check-ins.
- **Tests:** Vitest; pure helpers unit-tested; data layer + actions integration-verified.
- **Theme:** dark amber/zinc. **Commits:** small; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Friendship data layer + actions

**Files:**
- Create: `lib/friends/queries.ts`
- Create: `app/actions/friends.ts`

**Interfaces:**
- Produces (`@/lib/friends/queries`, server-only):
  - `getFriendIds(userId: string): Promise<string[]>` — accepted, both directions.
  - `getFriends(userId: string): Promise<Profile[]>`
  - `getIncomingRequests(userId: string): Promise<Profile[]>`
  - `getOutgoingRequests(userId: string): Promise<Profile[]>`
  - `areFriends(a: string, b: string): Promise<boolean>`
  - `searchUsers(query: string, excludeUserId: string): Promise<Profile[]>`
  - (`Profile` = `typeof profile.$inferSelect`, re-imported from `@/lib/profile/queries`.)
- Produces (`@/app/actions/friends`, server actions):
  - `sendFriendRequest(targetUserId: string): Promise<{ status: "self" | "already-friends" | "already-requested" | "requested" | "accepted" | "error" }>`
  - `respondToRequest(requesterId: string, action: "accept" | "decline"): Promise<{ ok: boolean }>`
  - `removeFriend(otherUserId: string): Promise<{ ok: boolean }>`

- [ ] **Step 1: Implement the friends query layer**

```ts
// lib/friends/queries.ts
import "server-only";
import { and, or, eq, ne, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendship, profile } from "@/lib/db/schema";
import type { Profile } from "@/lib/profile/queries";

async function profilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  return db.select().from(profile).where(inArray(profile.userId, ids));
}

/** User ids of accepted friends (both directions). */
export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendship.requesterId, addresseeId: friendship.addresseeId })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId)),
      ),
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function getFriends(userId: string): Promise<Profile[]> {
  return profilesByIds(await getFriendIds(userId));
}

export async function getIncomingRequests(userId: string): Promise<Profile[]> {
  const rows = await db
    .select({ requesterId: friendship.requesterId })
    .from(friendship)
    .where(and(eq(friendship.status, "pending"), eq(friendship.addresseeId, userId)));
  return profilesByIds(rows.map((r) => r.requesterId));
}

export async function getOutgoingRequests(userId: string): Promise<Profile[]> {
  const rows = await db
    .select({ addresseeId: friendship.addresseeId })
    .from(friendship)
    .where(and(eq(friendship.status, "pending"), eq(friendship.requesterId, userId)));
  return profilesByIds(rows.map((r) => r.addresseeId));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ requesterId: friendship.requesterId })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(
          and(eq(friendship.requesterId, a), eq(friendship.addresseeId, b)),
          and(eq(friendship.requesterId, b), eq(friendship.addresseeId, a)),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function searchUsers(query: string, excludeUserId: string): Promise<Profile[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  const like = `%${q}%`;
  return db
    .select()
    .from(profile)
    .where(
      and(
        ne(profile.userId, excludeUserId),
        or(ilike(profile.username, like), ilike(profile.displayName, like)),
      ),
    )
    .limit(20);
}
```

- [ ] **Step 2: Implement the friendship mutation actions**

```ts
// app/actions/friends.ts
"use server";

import { and, or, eq } from "drizzle-orm";
import { requireSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { friendship, profile } from "@/lib/db/schema";

type SendStatus = "self" | "already-friends" | "already-requested" | "requested" | "accepted" | "error";

export async function sendFriendRequest(targetUserId: string): Promise<{ status: SendStatus }> {
  const session = await requireSession();
  const me = session.user.id;
  if (me === targetUserId) return { status: "self" };

  // Target must be a real profile.
  const target = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.userId, targetUserId))
    .limit(1);
  if (target.length === 0) return { status: "error" };

  // Any existing row in either direction?
  const existing = await db
    .select({ requesterId: friendship.requesterId, addresseeId: friendship.addresseeId, status: friendship.status })
    .from(friendship)
    .where(
      or(
        and(eq(friendship.requesterId, me), eq(friendship.addresseeId, targetUserId)),
        and(eq(friendship.requesterId, targetUserId), eq(friendship.addresseeId, me)),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.status === "accepted") return { status: "already-friends" };
    if (row.requesterId === me) return { status: "already-requested" };
    // Reverse pending request exists — accept it (mutual intent).
    await db
      .update(friendship)
      .set({ status: "accepted" })
      .where(and(eq(friendship.requesterId, targetUserId), eq(friendship.addresseeId, me)));
    return { status: "accepted" };
  }

  await db
    .insert(friendship)
    .values({ requesterId: me, addresseeId: targetUserId, status: "pending" })
    .onConflictDoNothing();
  return { status: "requested" };
}

export async function respondToRequest(
  requesterId: string,
  action: "accept" | "decline",
): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const me = session.user.id;
  const where = and(
    eq(friendship.requesterId, requesterId),
    eq(friendship.addresseeId, me),
    eq(friendship.status, "pending"),
  );
  if (action === "accept") {
    await db.update(friendship).set({ status: "accepted" }).where(where);
  } else {
    await db.delete(friendship).where(where);
  }
  return { ok: true };
}

export async function removeFriend(otherUserId: string): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const me = session.user.id;
  await db
    .delete(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(
          and(eq(friendship.requesterId, me), eq(friendship.addresseeId, otherUserId)),
          and(eq(friendship.requesterId, otherUserId), eq(friendship.addresseeId, me)),
        ),
      ),
    );
  return { ok: true };
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` (expect exit 0) and `npm run build` (expect exit 0).

- [ ] **Step 4: Integration verification (throwaway script)**

Create `_verify-friends.ts` at the project root (so bare imports resolve) and run with `node --conditions=react-server --import tsx ./_verify-friends.ts` (the `react-server` condition makes the `server-only` import a no-op). It must: create two users+profiles A & B; insert a pending `friendship` (A→B) directly; call query functions with explicit ids (NOT the session actions — those need a request context) to assert `getIncomingRequests(B)` returns A, `getOutgoingRequests(A)` returns B, `areFriends(A,B)` is false; then set the row accepted and assert `areFriends(A,B)` true (both `areFriends(A,B)` and `areFriends(B,A)`), `getFriends(A)` returns B and `getFriends(B)` returns A; `searchUsers("<A's name fragment>", B)` returns A and excludes B. Delete all rows after. Expected: all assertions log OK. (The session-bound actions are verified through the UI in Tasks 2–4; this proves the both-directions query logic against the live DB.) Then `rm -f _verify-friends.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/friends/queries.ts app/actions/friends.ts
git commit -m "feat(friends): friendship queries (both-directions) + request/respond/remove actions"
```

---

## Task 2: Friends page + user search

**Files:**
- Create: `app/friends/page.tsx`
- Create: `app/api/users/search/route.ts`
- Create: `components/friends/RequestActions.tsx`
- Create: `components/friends/RemoveFriendButton.tsx`
- Create: `components/friends/UserSearch.tsx`

**Interfaces:**
- Consumes: `requireSession`, `getIncomingRequests`, `getFriends`, `searchUsers`, the friend actions, `Avatar`.
- `GET /api/users/search?q=` → `{ users: { userId: string; username: string; displayName: string; avatarUrl: string | null }[] }` (empty if logged out or `q` empty).

- [ ] **Step 1: User-search route**

```ts
// app/api/users/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dal";
import { searchUsers } from "@/lib/friends/queries";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ users: [] });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchUsers(q, session.user.id);
  return NextResponse.json({
    users: results.map((p) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
    })),
  });
}
```

- [ ] **Step 2: Request accept/decline buttons (client)**

```tsx
// components/friends/RequestActions.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToRequest } from "@/app/actions/friends";

export default function RequestActions({ requesterId }: { requesterId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function respond(action: "accept" | "decline") {
    setPending(true);
    await respondToRequest(requesterId, action);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond("accept")}
        disabled={pending}
        className="rounded-lg bg-amber-400 px-3 py-1 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => respond("decline")}
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Remove-friend button (client)**

```tsx
// components/friends/RemoveFriendButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeFriend } from "@/app/actions/friends";

export default function RemoveFriendButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      onClick={async () => {
        setPending(true);
        await removeFriend(userId);
        router.refresh();
      }}
      disabled={pending}
      className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
    >
      Remove
    </button>
  );
}
```

- [ ] **Step 4: User search (client)**

```tsx
// components/friends/UserSearch.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { sendFriendRequest } from "@/app/actions/friends";

type Found = { userId: string; username: string; displayName: string; avatarUrl: string | null };

export default function UserSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  async function search(value: string) {
    setQ(value);
    if (value.trim().length === 0) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`);
    const body: { users: Found[] } = await res.json();
    setResults(body.users);
  }

  async function add(userId: string) {
    const { status } = await sendFriendRequest(userId);
    setStatuses((s) => ({ ...s, [userId]: status }));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or @username"
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <ul className="flex flex-col gap-2">
        {results.map((u) => (
          <li key={u.userId} className="flex items-center gap-3">
            <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
            <Link href={`/u/${u.username}`} className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-100">{u.displayName}</span>
              <span className="block truncate text-xs text-zinc-400">@{u.username}</span>
            </Link>
            <button
              onClick={() => add(u.userId)}
              disabled={!!statuses[u.userId]}
              className="ml-auto rounded-lg bg-amber-400 px-3 py-1 text-sm font-medium text-zinc-950 disabled:opacity-60"
            >
              {statuses[u.userId] === "requested"
                ? "Requested"
                : statuses[u.userId] === "accepted"
                  ? "Friends"
                  : statuses[u.userId] === "already-friends"
                    ? "Friends"
                    : statuses[u.userId] === "already-requested"
                      ? "Requested"
                      : "Add"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Friends page (server)**

```tsx
// app/friends/page.tsx
import Link from "next/link";
import { requireSession } from "@/lib/dal";
import { getIncomingRequests, getFriends } from "@/lib/friends/queries";
import Avatar from "@/components/Avatar";
import RequestActions from "@/components/friends/RequestActions";
import RemoveFriendButton from "@/components/friends/RemoveFriendButton";
import UserSearch from "@/components/friends/UserSearch";

export default async function FriendsPage() {
  const session = await requireSession();
  const [incoming, friends] = await Promise.all([
    getIncomingRequests(session.user.id),
    getFriends(session.user.id),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Friends</h1>
        <UserSearch />
      </section>

      {incoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Requests ({incoming.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {incoming.map((p) => (
              <li key={p.userId} className="flex items-center gap-3">
                <Avatar name={p.displayName} src={p.avatarUrl} size={36} />
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">{p.displayName}</span>
                  <span className="block truncate text-xs text-zinc-400">@{p.username}</span>
                </div>
                <div className="ml-auto">
                  <RequestActions requesterId={p.userId} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-zinc-500">No friends yet — search above to add some.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((p) => (
              <li key={p.userId} className="flex items-center gap-3">
                <Avatar name={p.displayName} src={p.avatarUrl} size={36} />
                <Link href={`/u/${p.username}`} className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">{p.displayName}</span>
                  <span className="block truncate text-xs text-zinc-400">@{p.username}</span>
                </Link>
                <div className="ml-auto">
                  <RemoveFriendButton userId={p.userId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (exit 0), `npm run build` (exit 0). Dev server: log in as two users (two browsers / a cookie jar), search and send a request from A→B; B sees the request at `/friends` and accepts; both appear in each other's friends list; remove works.

- [ ] **Step 7: Commit**

```bash
git add app/friends/page.tsx app/api/users/search/route.ts components/friends/
git commit -m "feat(friends): friends page (requests, list, user search + add)"
```

---

## Task 3: Friends-only feed

**Files:**
- Create: `lib/timeAgo.ts`
- Test: `lib/timeAgo.test.ts`
- Modify: `lib/friends/queries.ts` (add `getFriendsFeed`)
- Create: `app/feed/page.tsx`

**Interfaces:**
- Produces: `timeAgo(from: Date, now: Date): string`; `FeedItem = { id: string; username: string; displayName: string; avatarUrl: string | null; barId: string; createdAt: Date }`; `getFriendsFeed(userId: string): Promise<FeedItem[]>`.

- [ ] **Step 1: Write failing tests for timeAgo**

```ts
// lib/timeAgo.test.ts
import { describe, it, expect } from "vitest";
import { timeAgo } from "@/lib/timeAgo";

const now = new Date("2026-06-21T12:00:00Z");

describe("timeAgo", () => {
  it("'just now' under a minute", () => {
    expect(timeAgo(new Date("2026-06-21T11:59:30Z"), now)).toBe("just now");
  });
  it("minutes", () => {
    expect(timeAgo(new Date("2026-06-21T11:55:00Z"), now)).toBe("5m ago");
  });
  it("hours", () => {
    expect(timeAgo(new Date("2026-06-21T10:00:00Z"), now)).toBe("2h ago");
  });
  it("days", () => {
    expect(timeAgo(new Date("2026-06-18T12:00:00Z"), now)).toBe("3d ago");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/timeAgo.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement timeAgo**

```ts
// lib/timeAgo.ts
export function timeAgo(from: Date, now: Date): string {
  const s = Math.floor((now.getTime() - from.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/timeAgo.test.ts`
Expected: PASS.

- [ ] **Step 5: Add getFriendsFeed to the query layer**

Append to `lib/friends/queries.ts` (add `desc` to the drizzle import and `checkin` to the schema import):

```ts
// add `desc` to the "drizzle-orm" import; add `checkin` to the "@/lib/db/schema" import.

export interface FeedItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  barId: string;
  createdAt: Date;
}

export async function getFriendsFeed(userId: string): Promise<FeedItem[]> {
  const friendIds = await getFriendIds(userId);
  if (friendIds.length === 0) return [];
  return db
    .select({
      id: checkin.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      barId: checkin.barId,
      createdAt: checkin.createdAt,
    })
    .from(checkin)
    .innerJoin(profile, eq(checkin.userId, profile.userId))
    .where(inArray(checkin.userId, friendIds))
    .orderBy(desc(checkin.createdAt))
    .limit(50);
}
```

- [ ] **Step 6: Feed page**

```tsx
// app/feed/page.tsx
import Link from "next/link";
import { requireSession } from "@/lib/dal";
import { getFriendsFeed } from "@/lib/friends/queries";
import { barName } from "@/lib/favorites";
import { timeAgo } from "@/lib/timeAgo";
import Avatar from "@/components/Avatar";

export default async function FeedPage() {
  const session = await requireSession();
  const items = await getFriendsFeed(session.user.id);
  const now = new Date();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Feed</h1>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No check-ins yet. <Link href="/friends" className="text-amber-400">Add friends</Link> to see where they&apos;re out.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <Avatar name={item.displayName} src={item.avatarUrl} size={40} />
              <p className="min-w-0 text-sm text-zinc-200">
                <Link href={`/u/${item.username}`} className="font-semibold">
                  {item.displayName}
                </Link>{" "}
                checked in at{" "}
                <span className="font-medium text-amber-300">{barName(item.barId) ?? "a bar"}</span>
              </p>
              <span className="ml-auto shrink-0 text-xs text-zinc-500">{timeAgo(item.createdAt, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit` (exit 0), `npm test` (all pass), `npm run build` (exit 0). Dev server: with two friends, a check-in by one appears in the other's `/feed`.

```bash
git add lib/timeAgo.ts lib/timeAgo.test.ts lib/friends/queries.ts app/feed/page.tsx
git commit -m "feat(feed): friends-only check-in feed + timeAgo helper"
```

---

## Task 4: Friend-gated check-ins on profile + header nav

**Files:**
- Modify: `lib/friends/queries.ts` (add `getVisibleCheckins`)
- Create: `components/profile/RecentCheckins.tsx`
- Modify: `components/profile/ProfileView.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/u/[username]/page.tsx`
- Modify: `components/auth/UserMenu.tsx`

**Interfaces:**
- Produces: `getVisibleCheckins(profileUserId: string, viewerUserId: string | null): Promise<{ visible: boolean; items: FeedItem[] }>`.
- `ProfileView` gains prop `recentCheckins: { visible: boolean; items: FeedItem[] }`.

- [ ] **Step 1: Add getVisibleCheckins**

Append to `lib/friends/queries.ts`:

```ts
/**
 * Recent check-ins for a profile, visible only to the owner or accepted
 * friends. `visible: false` means the viewer isn't allowed to see them.
 */
export async function getVisibleCheckins(
  profileUserId: string,
  viewerUserId: string | null,
): Promise<{ visible: boolean; items: FeedItem[] }> {
  const isSelf = viewerUserId === profileUserId;
  const visible = isSelf || (viewerUserId !== null && (await areFriends(viewerUserId, profileUserId)));
  if (!visible) return { visible: false, items: [] };

  const items = await db
    .select({
      id: checkin.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      barId: checkin.barId,
      createdAt: checkin.createdAt,
    })
    .from(checkin)
    .innerJoin(profile, eq(checkin.userId, profile.userId))
    .where(eq(checkin.userId, profileUserId))
    .orderBy(desc(checkin.createdAt))
    .limit(10);
  return { visible: true, items };
}
```

- [ ] **Step 2: RecentCheckins component**

```tsx
// components/profile/RecentCheckins.tsx
import { barName } from "@/lib/favorites";
import { timeAgo } from "@/lib/timeAgo";
import type { FeedItem } from "@/lib/friends/queries";

export default function RecentCheckins({
  visible,
  items,
}: {
  visible: boolean;
  items: FeedItem[];
}) {
  if (!visible) {
    return <p className="text-sm text-zinc-500">Check-ins are visible to friends.</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No check-ins yet.</p>;
  }
  const now = new Date();
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-200">{barName(item.barId) ?? "a bar"}</span>
          <span className="text-xs text-zinc-500">{timeAgo(item.createdAt, now)}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Add recentCheckins to ProfileView**

In `components/profile/ProfileView.tsx`: import the component + `FeedItem` type, add the prop, and render a section after Favorite bars. Add to the props interface:

```tsx
  recentCheckins: { visible: boolean; items: FeedItem[] };
```

Add imports:

```tsx
import RecentCheckins from "@/components/profile/RecentCheckins";
import type { FeedItem } from "@/lib/friends/queries";
```

Add `recentCheckins` to the destructured params, and add this section just before the closing `</main>`:

```tsx
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent check-ins</h2>
        <RecentCheckins visible={recentCheckins.visible} items={recentCheckins.items} />
      </section>
```

- [ ] **Step 4: Pass recentCheckins from both profile pages**

In `app/profile/page.tsx`, import `getVisibleCheckins` from `@/lib/friends/queries`, add it to the `Promise.all` (owner viewing self → always visible), and pass `recentCheckins`:

```tsx
import { getVisibleCheckins } from "@/lib/friends/queries";
```

```tsx
  const [badges, favoriteBarIds, checkins, recentCheckins] = await Promise.all([
    getEarnedBadges(session.user.id),
    getFavoriteBarIds(session.user.id),
    getCheckinSummary(session.user.id),
    getVisibleCheckins(session.user.id, session.user.id),
  ]);

  return (
    <ProfileView
      profile={profile}
      badges={badges}
      favoriteBarIds={favoriteBarIds}
      checkins={checkins}
      recentCheckins={recentCheckins}
      isOwner
    />
  );
```

In `app/u/[username]/page.tsx`, import `getVisibleCheckins`, compute it with the viewer's id (or null), and pass it. Since the viewer's session is already fetched, add after computing `isOwner`:

```tsx
import { getVisibleCheckins } from "@/lib/friends/queries";
```

```tsx
  const recentCheckins = await getVisibleCheckins(profile.userId, session?.user?.id ?? null);

  return (
    <ProfileView
      profile={profile}
      badges={badges}
      favoriteBarIds={favoriteBarIds}
      checkins={checkins}
      recentCheckins={recentCheckins}
      isOwner={isOwner}
    />
  );
```

- [ ] **Step 5: Add Feed + Friends links to the header menu**

In `components/auth/UserMenu.tsx`, add `Feed` and `Friends` links next to `Profile` (only shown when logged in). Replace the logged-in block:

```tsx
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/feed" className="font-medium text-zinc-200">Feed</Link>
      <Link href="/friends" className="font-medium text-zinc-200">Friends</Link>
      <Link href="/profile" className="font-medium text-zinc-200">Profile</Link>
      <button
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="text-zinc-400 hover:text-white"
      >
        Log out
      </button>
    </div>
  );
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit` (exit 0), `npm test` (all pass), `npm run build` (exit 0). Dev server: viewing a non-friend's `/u/[username]` shows "Check-ins are visible to friends"; after befriending, their recent check-ins appear; the header shows Feed/Friends/Profile when logged in.

```bash
git add lib/friends/queries.ts components/profile/RecentCheckins.tsx components/profile/ProfileView.tsx app/profile/page.tsx "app/u/[username]/page.tsx" components/auth/UserMenu.tsx
git commit -m "feat(friends): friend-gated check-ins on profile + header nav"
```

---

## Definition of Done

- [ ] `npm test` passes (timeAgo + existing).
- [ ] `npm run build` exit 0; `tsc --noEmit` exit 0.
- [ ] A user can search, send a request, the addressee accepts/declines, both see each other in friends, and either can unfriend.
- [ ] `/feed` shows accepted friends' check-ins (reverse-chron) with relative time; empty state links to `/friends`.
- [ ] A non-friend viewing `/u/[username]` does NOT see check-ins; a friend (or self) does.
- [ ] Header shows Feed / Friends / Profile when logged in.
- [ ] Crowd engine files untouched.

## Hand-off to Team D (Leaderboards)

Friendships are queryable via `getFriendIds(userId)` — Team D's friend-leaderboard scope reuses it. The feed/profile read patterns over `checkin` are established; leaderboards aggregate `points_ledger` (Phase 1B) over time windows.

## Self-Review

- **Spec coverage (spec §7 Friends + privacy):** mutual request/accept/decline ✅(T1 actions, T2 UI), friends list + unfriend ✅(T1,T2), user search ✅(T1,T2), friends-only feed ✅(T3), friend-gated check-in visibility on profiles ✅(T4), header nav ✅(T4). Both-directions friendship logic ✅(T1 `areFriends`/`getFriendIds`/`removeFriend`).
- **Placeholder scan:** none — all code complete; T1 Step 4 + UI steps are verification, the pure `timeAgo` is unit-tested.
- **Type consistency:** `Profile` reused from `@/lib/profile/queries`; `FeedItem` defined in T3 and consumed in T3/T4 (`getVisibleCheckins`, `RecentCheckins`, `ProfileView`); `sendFriendRequest`/`respondToRequest`/`removeFriend` signatures consistent between T1 and the T2 components; `getFriendIds` reused by `getFriends` (T1), `getFriendsFeed` (T3), and `getVisibleCheckins` via `areFriends` (T4).
