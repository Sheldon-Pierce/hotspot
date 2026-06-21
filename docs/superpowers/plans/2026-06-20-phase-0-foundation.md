# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HotSpot's first persistent, authenticated backend — Postgres + Drizzle, Better Auth (email/password + Google), the full frozen schema, login/signup/onboarding, route protection, and seeded badge definitions — so that a user can register, pick a unique `@username`, and land on a profile row.

**Architecture:** A new stateful layer runs *alongside* the existing stateless crowd engine. The existing `/api/bars` + simulation are untouched. Auth is handled in-process by Better Auth backed by Drizzle/Postgres. Route protection uses an optimistic `proxy.ts` check plus a server-side Data Access Layer (`lib/dal.ts`) for secure checks. The **complete schema is defined here and frozen**, so Phase 1 feature teams build against a stable contract.

**Tech Stack:** Next.js 16 (App Router, modified), React 19, TypeScript, Tailwind 4, Drizzle ORM + drizzle-kit, Postgres (`postgres` driver), Better Auth, Zod, Vitest.

## Global Constraints

- **This is a modified Next.js 16.** Route protection file is `proxy.ts` at project root, NOT `middleware.ts`. Function: `export function proxy(req: NextRequest)`. Verbatim from `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`: *"Starting with Next.js 16, Middleware is now called Proxy."*
- **`cookies()`, `headers()`, and route `params` are async** — always `await` them.
- **Proxy = optimistic checks only.** Verbatim: *"it should not be used as a full session management or authorization solution."* Secure authz lives in `lib/dal.ts`.
- **Do NOT modify** `/api/bars/route.ts`, `lib/simulation.ts`, `lib/deals.ts`, `lib/presets.ts`, or `data/bars.ts`. The crowd engine stays stateless.
- **Path alias:** `@/*` maps to the project root (e.g. `@/lib/db`).
- **Tests:** Vitest (`npm test` → `vitest run`). Mirror the existing pure-function test style in `lib/simulation.test.ts`.
- **Commits:** small and frequent, one per task minimum. Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Bar IDs** referenced by user data are the string ids in `data/bars.ts` (e.g. `kings-hardware`). They are NOT foreign keys (bars are seed data, not DB rows) — store as `text` and validate against the seed list.

## Prerequisites (external, user-provided)

These are the only new config values. **Email/password auth works without Google** — Google can be added later by filling its two vars.

```bash
# .env.local (gitignored)
DATABASE_URL=postgres://hotspot:hotspot@localhost:5432/hotspot
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=          # optional for now
GOOGLE_CLIENT_SECRET=      # optional for now
```

Local Postgres for dev/test (Docker):

```bash
docker run --name hotspot-pg -e POSTGRES_USER=hotspot -e POSTGRES_PASSWORD=hotspot -e POSTGRES_DB=hotspot -p 5432:5432 -d postgres:16
```

---

## Task 1: Install dependencies & environment scaffolding

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env.local` ignored)
- Create: `docs/DB.md` (how to run local Postgres)

**Interfaces:**
- Produces: npm scripts `db:generate`, `db:migrate`, `db:seed`; installed packages `drizzle-orm`, `postgres`, `drizzle-kit`, `better-auth`, `zod`.

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
npm install drizzle-orm postgres better-auth zod
npm install -D drizzle-kit @types/pg
```

- [ ] **Step 2: Add database scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:seed": "tsx lib/db/seed.ts"
```

Install the seed runner: `npm install -D tsx`

- [ ] **Step 3: Create `.env.example`**

```bash
DATABASE_URL=postgres://hotspot:hotspot@localhost:5432/hotspot
BETTER_AUTH_SECRET=replace-with-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 4: Ensure `.env.local` is gitignored**

Confirm `.gitignore` contains `.env*` (Create Next App default does). If not, add `.env.local`.

- [ ] **Step 5: Write `docs/DB.md`** documenting the Docker command from Prerequisites and the migrate/seed flow.

- [ ] **Step 6: Verify install**

Run: `npm run build`
Expected: build still succeeds (no code changed yet, deps installed).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore docs/DB.md
git commit -m "chore: add db + auth dependencies and env scaffolding"
```

---

## Task 2: Database client & Drizzle config

**Files:**
- Create: `lib/db/index.ts`
- Create: `drizzle.config.ts`
- Test: `lib/db/index.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle client) exported from `@/lib/db`. Later tasks import `{ db }` from here.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/index.test.ts
import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

describe("db client", () => {
  it("connects and runs a trivial query", async () => {
    const result = await db.execute(sql`select 1 as one`);
    // `postgres` driver returns rows array-like
    expect(result[0]).toMatchObject({ one: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/index.test.ts`
Expected: FAIL — cannot find module `@/lib/db`.

- [ ] **Step 3: Implement the db client**

```ts
// lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse the client across hot-reloads in dev.
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
const client = globalForDb._pg ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb._pg = client;

export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Create `drizzle.config.ts`**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 5: Create an empty schema so the import resolves**

```ts
// lib/db/schema.ts
// Tables are added in Task 3. This file is the single frozen schema contract.
export {};
```

- [ ] **Step 6: Run test to verify it passes**

Ensure local Postgres is running and `.env.local` is set, then:
Run: `npx vitest run lib/db/index.test.ts`
Expected: PASS.

> If Vitest doesn't load `.env.local`, add `import "dotenv/config"` via a `vitest.config.ts` `setupFiles` entry pointing at a `vitest.setup.ts` that calls `config({ path: ".env.local" })` (install `dotenv`).

- [ ] **Step 7: Commit**

```bash
git add lib/db/index.ts lib/db/schema.ts drizzle.config.ts lib/db/index.test.ts vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "feat(db): add Drizzle/Postgres client and config"
```

---

## Task 3: Full frozen schema + first migration

This task defines **every table** so Phase 1 teams build against a stable contract. App tables are hand-written here; Better Auth's own tables (`user`, `session`, `account`, `verification`) are generated by its CLI to guarantee they match the installed version.

**Files:**
- Modify: `lib/db/schema.ts` (replace placeholder)
- Create: `drizzle/` migration output (generated)
- Test: `lib/db/schema.test.ts`

**Interfaces:**
- Produces (table objects exported from `@/lib/db/schema`): `user`, `session`, `account`, `verification`, `profile`, `favorite`, `checkin`, `friendship`, `badge`, `userBadge`, `pointsLedger`. Column names and types below are the frozen contract every Phase 1 task consumes.

- [ ] **Step 1: Write the app tables in `lib/db/schema.ts`**

```ts
// lib/db/schema.ts
import {
  pgTable, text, timestamp, boolean, integer, doublePrecision,
  uniqueIndex, index, primaryKey, pgEnum,
} from "drizzle-orm/pg-core";

// ── Better Auth core tables are appended by `npx @better-auth/cli generate`
//    in Step 3. Do not hand-edit them after generation.

// ── App tables ────────────────────────────────────────────────────────────

export const checkinVerification = pgEnum("checkin_verification", ["honor", "geofence"]);
export const friendshipStatus = pgEnum("friendship_status", ["pending", "accepted"]);

/** 1:1 with Better Auth `user`. user.id is text. */
export const profile = pgTable(
  "profile",
  {
    userId: text("user_id").primaryKey(), // references user.id (added in Step 4)
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    points: integer("points").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("profile_username_idx").on(t.username)],
);

export const favorite = pgTable(
  "favorite",
  {
    userId: text("user_id").notNull(),
    barId: text("bar_id").notNull(), // matches data/bars.ts ids; not an FK
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.barId] })],
);

export const checkin = pgTable(
  "checkin",
  {
    id: text("id").primaryKey(), // crypto.randomUUID()
    userId: text("user_id").notNull(),
    barId: text("bar_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    verification: checkinVerification("verification").notNull().default("honor"),
    // shaped to emit a CountEvent later (see lib/types.ts CountEvent)
    source: text("source").notNull().default("check-in"),
  },
  (t) => [
    index("checkin_user_idx").on(t.userId),
    index("checkin_user_bar_idx").on(t.userId, t.barId),
    index("checkin_created_idx").on(t.createdAt),
  ],
);

export const friendship = pgTable(
  "friendship",
  {
    requesterId: text("requester_id").notNull(),
    addresseeId: text("addressee_id").notNull(),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.requesterId, t.addresseeId] }),
    index("friendship_addressee_idx").on(t.addresseeId),
  ],
);

/** Badge definitions, seeded in Task 8. */
export const badge = pgTable("badge", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // emoji or icon name
  criteria: text("criteria").notNull(), // human-readable; engine logic keyed by `key`
});

export const userBadge = pgTable(
  "user_badge",
  {
    userId: text("user_id").notNull(),
    badgeKey: text("badge_key").notNull(),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeKey] })],
);

/** Append-only. Leaderboards aggregate amount over createdAt windows. */
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    checkinId: text("checkin_id"),
    reason: text("reason").notNull(), // e.g. "checkin", "new-bar", "badge:explorer"
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("points_user_idx").on(t.userId),
    index("points_created_idx").on(t.createdAt),
  ],
);
```

- [ ] **Step 2: Write a schema shape test**

```ts
// lib/db/schema.test.ts
import { describe, it, expect } from "vitest";
import * as schema from "@/lib/db/schema";

describe("schema", () => {
  it("exports all frozen-contract tables", () => {
    for (const name of [
      "profile", "favorite", "checkin", "friendship",
      "badge", "userBadge", "pointsLedger",
    ]) {
      expect(schema, `missing table export: ${name}`).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 3: Generate Better Auth tables into the schema**

Better Auth's CLI appends/creates the exact `user`, `session`, `account`, `verification` tables for the installed version. (It reads `lib/auth.ts`, so do this AFTER Task 4 if the CLI requires the auth config — otherwise run now with the default schema target.) Run:

```bash
npx @better-auth/cli@latest generate --output lib/db/schema.ts
```

Review the diff; the CLI adds the four auth tables and Drizzle relations. Do not hand-edit them afterward.

> If the CLI requires `lib/auth.ts` to exist first, reorder: do Task 4 Step 1–3, then return here.

- [ ] **Step 4: Generate and apply the migration**

```bash
npm run db:generate   # writes SQL to ./drizzle
npm run db:migrate    # applies to local Postgres
```

Expected: `drizzle/` contains a `0000_*.sql` with all tables; migrate reports success.

- [ ] **Step 5: Run the schema test**

Run: `npx vitest run lib/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/schema.test.ts drizzle/
git commit -m "feat(db): define frozen schema and initial migration"
```

---

## Task 4: Better Auth server config + route handler

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...all]/route.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, `schema` from `@/lib/db/schema`.
- Produces: `auth` exported from `@/lib/auth` (has `auth.api.getSession(...)`). The catch-all handler serves all `/api/auth/*` endpoints.

- [ ] **Step 1: Write the auth server config**

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  ...(google ? { socialProviders: google } : {}),
});
```

- [ ] **Step 2: Write the catch-all route handler**

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 3: Verify endpoints respond**

Start dev server (`npm run dev`) in one shell, then:
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/ok`
Expected: a 200 (Better Auth health/ok route) — confirms the handler is mounted. A non-404 status proves the catch-all works.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts "app/api/auth/[...all]/route.ts"
git commit -m "feat(auth): configure Better Auth server + route handler"
```

---

## Task 5: Auth client + Data Access Layer (DAL)

**Files:**
- Create: `lib/auth-client.ts`
- Create: `lib/dal.ts`

**Interfaces:**
- Produces:
  - `authClient` from `@/lib/auth-client` with `signIn`, `signUp`, `signOut`, `useSession` (client components).
  - `getSession(): Promise<Session | null>` and `requireSession(): Promise<Session>` (redirects to `/login` if absent) and `getCurrentProfile()` from `@/lib/dal` (server components / route handlers / server actions). `Session` has `session.user.id` (text).

- [ ] **Step 1: Write the client**

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 2: Write the DAL**

```ts
// lib/dal.ts
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

/** Returns the Better Auth session or null. Memoized per render pass. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Secure check: redirects to /login if unauthenticated. */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return session;
}

/** Current user's profile row, or null if onboarding incomplete. */
export const getCurrentProfile = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const rows = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, session.user.id))
    .limit(1);
  return rows[0] ?? null;
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/auth-client.ts lib/dal.ts
git commit -m "feat(auth): add auth client and server DAL"
```

---

## Task 6: Username validation + profile creation action

This is the testable core of onboarding. Username rules live in a pure, unit-tested validator.

**Files:**
- Create: `lib/profile/username.ts`
- Test: `lib/profile/username.test.ts`
- Create: `app/actions/profile.ts`

**Interfaces:**
- Consumes: `requireSession`, `db`, `profile` schema, `getCurrentProfile`.
- Produces:
  - `usernameSchema` (Zod) and `normalizeUsername(raw: string): string` from `@/lib/profile/username`.
  - `createProfile(prev, formData): Promise<{ error?: string }>` server action (`@/app/actions/profile`) — validates, enforces uniqueness, inserts a `profile` row, then `redirect("/profile")`.

- [ ] **Step 1: Write failing tests for the username validator**

```ts
// lib/profile/username.test.ts
import { describe, it, expect } from "vitest";
import { usernameSchema, normalizeUsername } from "@/lib/profile/username";

describe("normalizeUsername", () => {
  it("lowercases and strips a leading @", () => {
    expect(normalizeUsername("@SheLDon")).toBe("sheldon");
  });
});

describe("usernameSchema", () => {
  it("accepts 3–20 chars of [a-z0-9_]", () => {
    expect(usernameSchema.safeParse("bar_hopper99").success).toBe(true);
  });
  it("rejects too short", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });
  it("rejects illegal characters", () => {
    expect(usernameSchema.safeParse("has space").success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/profile/username.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator**

```ts
// lib/profile/username.ts
import { z } from "zod";

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .max(20, "Username must be at most 20 characters.")
      .regex(/^[a-z0-9_]+$/, "Use only letters, numbers, and underscores."),
  );
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/profile/username.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the profile creation action**

```ts
// app/actions/profile.ts
"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";
import { usernameSchema } from "@/lib/profile/username";

const schema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Display name is required.").max(50),
});

export async function createProfile(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireSession();

  if (await getCurrentProfile()) redirect("/profile"); // already onboarded

  const parsed = schema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { username, displayName } = parsed.data;

  const taken = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.username, username))
    .limit(1);
  if (taken.length > 0) return { error: "That username is taken." };

  await db.insert(profile).values({
    userId: session.user.id,
    username,
    displayName,
  });

  redirect("/profile");
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/profile/username.ts lib/profile/username.test.ts app/actions/profile.ts
git commit -m "feat(profile): username validation + profile creation action"
```

---

## Task 7: Login, signup & onboarding pages

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`
- Create: `app/onboarding/page.tsx`
- Create: `components/auth/AuthForm.tsx`
- Create: `components/auth/GoogleButton.tsx`

**Interfaces:**
- Consumes: `signIn`, `signUp` from `@/lib/auth-client`; `createProfile` action; `getSession`, `getCurrentProfile` from `@/lib/dal`.

- [ ] **Step 1: Shared email/password form (client component)**

```tsx
// components/auth/AuthForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));

    const res =
      mode === "signup"
        ? await signUp.email({ email, password, name: email.split("@")[0] })
        : await signIn.email({ email, password });

    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong.");
      return;
    }
    // New accounts have no profile yet → onboarding decides where to go.
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input name="email" type="email" placeholder="you@email.com" required
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2" />
      <input name="password" type="password" placeholder="Password" required minLength={8}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={pending} type="submit"
        className="rounded bg-orange-500 px-3 py-2 font-medium text-black disabled:opacity-50">
        {pending ? "…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Google button (client component)**

```tsx
// components/auth/GoogleButton.tsx
"use client";

import { signIn } from "@/lib/auth-client";

export default function GoogleButton() {
  return (
    <button
      onClick={() => signIn.social({ provider: "google", callbackURL: "/onboarding" })}
      className="rounded border border-zinc-700 px-3 py-2 font-medium"
    >
      Continue with Google
    </button>
  );
}
```

> If Google env vars are unset, the social endpoint will error; that's expected until creds are added. Keep the button but it's optional to render — gate on a public flag if desired.

- [ ] **Step 3: Login & signup pages**

```tsx
// app/login/page.tsx
import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import GoogleButton from "@/components/auth/GoogleButton";

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Log in to HotSpot</h1>
      <AuthForm mode="login" />
      <GoogleButton />
      <p className="text-sm text-zinc-400">
        No account? <Link href="/signup" className="text-orange-400">Sign up</Link>
      </p>
    </main>
  );
}
```

```tsx
// app/signup/page.tsx
import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import GoogleButton from "@/components/auth/GoogleButton";

export default function SignupPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Join HotSpot</h1>
      <AuthForm mode="signup" />
      <GoogleButton />
      <p className="text-sm text-zinc-400">
        Have an account? <Link href="/login" className="text-orange-400">Log in</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Onboarding page (server component + action)**

```tsx
// app/onboarding/page.tsx
import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import { createProfile } from "@/app/actions/profile";

export default async function OnboardingPage() {
  await requireSession();
  if (await getCurrentProfile()) redirect("/profile");

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Pick your handle</h1>
      <form action={createProfile} className="flex flex-col gap-3">
        <input name="username" placeholder="@username" required
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2" />
        <input name="displayName" placeholder="Display name" required
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2" />
        <button type="submit"
          className="rounded bg-orange-500 px-3 py-2 font-medium text-black">
          Continue
        </button>
      </form>
    </main>
  );
}
```

> Note: `createProfile` is wired as a plain `action={createProfile}` here. To surface the `{ error }` return inline, a later refinement can wrap it with `useActionState` in a small client component. Functional onboarding does not block on that.

- [ ] **Step 5: Manual verification**

Run dev server. Visit `/signup`, create an account with email/password, confirm redirect to `/onboarding`, submit a username, confirm a `profile` row exists:
Run: `docker exec hotspot-pg psql -U hotspot -d hotspot -c "select username, display_name from profile;"`
Expected: your row is listed.

- [ ] **Step 6: Commit**

```bash
git add app/login app/signup app/onboarding components/auth
git commit -m "feat(auth): login, signup, and onboarding pages"
```

---

## Task 8: Route protection (proxy) + auth-aware header

**Files:**
- Create: `proxy.ts` (project root — NOT `middleware.ts`)
- Modify: `components/Header.tsx`
- Create: `components/auth/UserMenu.tsx`

**Interfaces:**
- Consumes: Better Auth session cookie; `useSession`/`signOut` from `@/lib/auth-client`.

- [ ] **Step 1: Create `proxy.ts` (optimistic protection)**

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/profile", "/friends", "/feed", "/onboarding"];
const authRoutes = ["/login", "/signup"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Optimistic check only: presence of the Better Auth session cookie.
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith("better-auth.session"));

  if (protectedRoutes.some((r) => pathname.startsWith(r)) && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (authRoutes.some((r) => pathname.startsWith(r)) && hasSession) {
    return NextResponse.redirect(new URL("/profile", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.ico$).*)"],
};
```

> Per the Proxy doc, this is an *optimistic* check — `lib/dal.ts` `requireSession()` is the authoritative gate on every protected page/route/action. Verify the actual cookie name prefix via DevTools after login; adjust the `startsWith` if Better Auth's version differs.

- [ ] **Step 2: User menu (client component)**

```tsx
// components/auth/UserMenu.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

export default function UserMenu() {
  const { data } = useSession();
  const router = useRouter();

  if (!data?.user) {
    return <Link href="/login" className="text-sm font-medium text-orange-400">Log in</Link>;
  }
  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="text-sm font-medium">Profile</Link>
      <button
        onClick={async () => { await signOut(); router.push("/"); router.refresh(); }}
        className="text-sm text-zinc-400"
      >
        Log out
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Mount `UserMenu` in the header**

Read `components/Header.tsx`, then add `<UserMenu />` into the header's right-hand control cluster (next to the view/preset controls). Import it: `import UserMenu from "@/components/auth/UserMenu";`. Do not change existing view/preset props.

- [ ] **Step 4: Manual verification**

- Logged out: visiting `/profile` redirects to `/login`. ✅
- Logged in: visiting `/login` redirects to `/profile`; header shows "Profile / Log out". ✅

- [ ] **Step 5: Commit**

```bash
git add proxy.ts components/Header.tsx components/auth/UserMenu.tsx
git commit -m "feat(auth): proxy route protection + auth-aware header"
```

---

## Task 9: Seed badge definitions

**Files:**
- Create: `lib/db/seed.ts`
- Create: `lib/gamification/badges.ts`
- Test: `lib/gamification/badges.test.ts`

**Interfaces:**
- Produces: `BADGES` (array of `{ key, name, description, icon, criteria }`) from `@/lib/gamification/badges`. Phase 1 Team B's engine keys its award logic off `BADGES[].key`. Seed inserts/updates these rows.

- [ ] **Step 1: Write failing test for badge catalog integrity**

```ts
// lib/gamification/badges.test.ts
import { describe, it, expect } from "vitest";
import { BADGES } from "@/lib/gamification/badges";

describe("BADGES catalog", () => {
  it("has unique keys", () => {
    const keys = BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("includes the starter set", () => {
    const keys = BADGES.map((b) => b.key);
    for (const k of ["first-round", "explorer-5", "regular", "night-owl", "neighborhood-champ"]) {
      expect(keys).toContain(k);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/gamification/badges.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the badge catalog**

```ts
// lib/gamification/badges.ts
export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: string; // emoji
  criteria: string;
}

export const BADGES: BadgeDef[] = [
  { key: "first-round", name: "First Round", icon: "🍺",
    description: "Your very first check-in.", criteria: "1 check-in" },
  { key: "explorer-5", name: "Explorer", icon: "🧭",
    description: "Checked in at 5 different bars.", criteria: "5 distinct bars" },
  { key: "explorer-10", name: "Trailblazer", icon: "🗺️",
    description: "Checked in at 10 different bars.", criteria: "10 distinct bars" },
  { key: "regular", name: "Regular", icon: "🪑",
    description: "10 check-ins at a single bar.", criteria: "10 check-ins at one bar" },
  { key: "night-owl", name: "Night Owl", icon: "🦉",
    description: "Checked in after midnight.", criteria: "check-in hour >= 0 and < 4" },
  { key: "neighborhood-champ", name: "Neighborhood Champ", icon: "👑",
    description: "Most points at a bar.", criteria: "top of a bar leaderboard" },
];
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/gamification/badges.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the seed script**

```ts
// lib/db/seed.ts
import { db } from "@/lib/db";
import { badge } from "@/lib/db/schema";
import { BADGES } from "@/lib/gamification/badges";

async function main() {
  for (const b of BADGES) {
    await db
      .insert(badge)
      .values(b)
      .onConflictDoUpdate({
        target: badge.key,
        set: { name: b.name, description: b.description, icon: b.icon, criteria: b.criteria },
      });
  }
  console.log(`Seeded ${BADGES.length} badges.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Run the seed and verify**

```bash
npm run db:seed
docker exec hotspot-pg psql -U hotspot -d hotspot -c "select key, name from badge order by key;"
```

Expected: all six badges listed.

- [ ] **Step 7: Commit**

```bash
git add lib/db/seed.ts lib/gamification/badges.ts lib/gamification/badges.test.ts
git commit -m "feat(gamification): badge catalog + seed script"
```

---

## Phase 0 Done — Definition of Done

- [ ] `npm test` passes (db, schema, username, badges tests).
- [ ] `npm run build` succeeds.
- [ ] A new user can sign up (email/password), pick a unique `@username`, and a `profile` row is created.
- [ ] Visiting `/profile` while logged out redirects to `/login` (proxy); the page itself re-checks via `requireSession()` (DAL).
- [ ] Badge definitions are seeded.
- [ ] The crowd engine (`/api/bars`, map, list) is unchanged and still works.

## Hand-off to Phase 1 (frozen contract)

Phase 1 teams build against the table exports in `lib/db/schema.ts` and these helpers:
`getSession`, `requireSession`, `getCurrentProfile` (`@/lib/dal`); `authClient` (`@/lib/auth-client`); `BADGES` (`@/lib/gamification/badges`).

- **Team A — Profiles & Favorites:** `app/profile`, `app/u/[username]`, favorites actions/UI.
- **Team B — Check-ins & Gamification engine:** `POST /api/checkins`, `lib/gamification/` (points, level, badge evaluation — pure + tested), badge case UI. **Lands the check-in write + points-ledger first.**
- **Team C — Friends & Feed:** friend requests/accept, `app/friends`, user search, `app/feed`. Reads `checkin` rows (friend-gated via DAL).
- **Team D — Leaderboards:** aggregate `points_ledger` over windows; `app/leaderboard`.

## Self-Review (completed)

- **Spec coverage:** auth ✅(T4,5,7), DB+Drizzle ✅(T1–3), frozen schema ✅(T3), profiles bootstrap ✅(T6,7), proxy/route-protection per modified Next 16 ✅(T8), badges seed ✅(T9). Favorites/check-in/friends/leaderboard *behavior* are Phase 1 by design; their tables are frozen here.
- **Placeholder scan:** none — every code step has complete code; library-generated artifacts (Better Auth tables, migrations) use concrete CLI commands.
- **Type consistency:** schema exports (`userBadge`, `pointsLedger`, etc.) referenced consistently across T3/T9; DAL `getCurrentProfile`/`requireSession` names reused in T6/T7/T8 consistently.
