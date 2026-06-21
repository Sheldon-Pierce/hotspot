# HotSpot — User Accounts, Social & Gamification

**Status:** Approved design (2026-06-20)
**Author:** Sheldon Pierce (with Claude)
**Supersedes:** n/a — first stateful feature set

## 1. Summary

HotSpot today is a deliberately **stateless** app: bar occupancy is a pure function of
`(bar, timestamp)`, so it deploys to Vercel with no database and no config. This project
adds the app's first **persistent, authenticated, per-user system**: login, profiles,
favorites, mutual friends, check-ins, and a full gamification layer (badges + points +
leaderboards).

The existing crowd engine (`/api/bars`, `lib/simulation.ts`, the map/list UI) is **not
rewritten**. The new user-data system runs alongside it. `/api/bars` remains
unauthenticated and unchanged.

## 2. Goals & non-goals

### Goals
- Real, secure authentication suitable for real users with real PII.
- User profiles with a unique `@username`, display name, avatar, bio.
- Favorite bars saved per user.
- Mutual friendships (request + accept) and a friends-only check-in feed.
- Check-ins to bars (social-only for now).
- Gamification: badges, points, and leaderboards.
- Stay free to launch ($0) and keep deploys lean (DB URL + a few secrets only).

### Non-goals (explicitly deferred — YAGNI)
- **Phase 2:** wiring check-ins into the *live crowd count* via device geolocation +
  the existing `CountEvent` contract. The check-in schema is shaped to support this
  later, but it is NOT wired to occupancy now.
- Favorite-deal notifications.
- Apple login (start with Google + email/password; Apple needs a paid dev account).
- Points/leaderboard anti-abuse beyond cooldown + the verification seam.

## 3. Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Project stage | Real product, real users | Justifies real auth, privacy, durable data. |
| Auth + DB stack | **Better Auth (in-process) + managed Postgres + Drizzle ORM** | Open-source, free, no per-user fees, no lock-in, near one-click deploy. Keycloak rejected as too heavy/ops-costly for a single consumer app. |
| First login methods | Email/password + Google | Apple deferred (paid account). |
| Check-in model | Social-only now; geolocation-verified + count-feeding later | Faked check-ins can't pollute the crowd map today; clean seam for later. |
| Social model | Mutual friends (request + accept) | Matches "friends list"; privacy-friendly; check-ins default friends-only. |
| Gamification depth | Badges + points + leaderboards | Full layer requested; sequenced so it doesn't block other features. |
| Avatar storage | Vercel Blob (free tier), default generated avatar | Already on Vercel; free tier sufficient. |

## 4. Architecture

New layers added alongside the existing stateless engine:

| Layer | Adds |
|---|---|
| **Database** | Postgres (managed, e.g. Neon) via **Drizzle ORM** + Drizzle Kit migrations. First stateful store. |
| **Auth** | **Better Auth**: email/password + Google, sessions, email verification, server session helpers, route protection. |
| **API (extend)** | New authenticated routes (§6). `/api/bars` untouched. |
| **Gamification engine** | New `lib/gamification/` — pure, deterministic, unit-tested functions (mirrors `lib/simulation.ts` style). |
| **UI (extend)** | New pages: `/login`, `/signup`, onboarding, `/profile`, `/u/[username]`, `/friends`, `/feed`, `/leaderboard`; check-in button on `BarDetail`; auth-aware header. |
| **File storage** | Avatars via Vercel Blob; default generated avatar when none uploaded. |

### Constraints
- **`AGENTS.md`:** this is a modified Next.js 16 — read `node_modules/next/dist/docs/`
  before writing route/middleware/server code. Phase 0 must **de-risk Better Auth ↔
  Next 16 App Router** integration before features are built on it.
- **Lean deploy:** the only new config is `DATABASE_URL`, Better Auth secrets, Google
  OAuth client id/secret, and a Vercel Blob token.

## 5. Data model

The **full schema is defined in Phase 0 and frozen** so parallel teams build against a
stable contract. Tables (Drizzle):

- **Better Auth managed:** `user`, `session`, `account`, `verification`.
- **`profile`** — 1:1 with `user`: unique `username` (@handle), `displayName`,
  `avatarUrl`, `bio`, `points` (denormalized total), `createdAt`. Basics public;
  check-ins friends-only.
- **`favorite`** — `(userId, barId)`; `barId` references existing seed bar IDs.
- **`checkin`** — `id, userId, barId, createdAt`, optional `lat`/`lng`,
  `verification` enum (`honor` now; `geofence` reserved), `source` field shaped to emit
  a `CountEvent` later. NOT wired to live counts yet.
- **`friendship`** — `(requesterId, addresseeId, status: pending|accepted, createdAt)`;
  one row per pair, queried both directions.
- **`badge`** — definitions: `key, name, description, icon, criteria`.
- **`user_badge`** — `(userId, badgeKey, earnedAt)`.
- **`points_ledger`** — append-only `(userId, checkinId?, reason, amount, createdAt)`.
  Leaderboards aggregate this over time windows. (Ledger beats a mutable counter because
  leaderboards need "points *this week*.")

**Anti-cheat from day one:** server-enforced cooldown (one *scoring* check-in per bar per
N hours) and the `verification` seam ready for geolocation.

## 6. API surface (new, authenticated)

`/api/bars` is unchanged. New routes:

- `GET /api/me` — current user + profile + points/level + badges.
- `GET /api/profile`, `PUT /api/profile` — read/update own profile.
- `GET /api/users/:username` — public profile; includes check-ins only if friend or self.
- `GET /api/users?q=` — search users by @username / display name.
- `POST /api/checkins` — create check-in (cooldown enforced; runs gamification engine).
- `GET /api/checkins?user=` — check-ins for a user (friend-gated).
- `POST /api/favorites`, `DELETE /api/favorites/:barId`, `GET /api/favorites`.
- `POST /api/friends/requests`, `POST /api/friends/requests/:id/accept`,
  `.../decline`, `DELETE /api/friends/:userId` (unfriend), `GET /api/friends`,
  `GET /api/friends/requests` (incoming/outgoing).
- `GET /api/feed` — reverse-chron check-ins from accepted friends.
- `GET /api/leaderboard?scope=friends|neighborhood&window=week|all`.

**Cross-cutting:** zod validation (→400), auth required (→401/redirect), friendship
checks server-side on every read of another user's data (→403), rate-limiting on
check-ins + friend requests. Better Auth handles session/CSRF.

## 7. Feature behavior

- **Onboarding:** sign up (email/pw or Google) → first-login step forces a unique
  `@username` + display name → land on profile. Email/pw requires verification.
- **Profile:** own profile editable (display name, bio, avatar, favorites). Public
  `/u/[username]` shows basics + badge case + points/level + favorites; check-ins shown
  only to friends/self. Stats: total check-ins, distinct bars, current streak.
- **Favorites:** star/unstar from `BarDetail`/list; favorites pin to top of list view.
- **Check-ins:** "I'm here" on `BarDetail` (auth required) → writes check-in, runs
  gamification engine, toasts points/badges earned. Cooldown server-enforced. Optional
  geolocation captured with permission for forward-compat.
- **Gamification:**
  - **Points** (tunable config): ~+10 per scoring check-in, bonus for a *new* bar,
    streak bonuses; some badges grant bonus points. Pure functions.
  - **Badges** (seeded starter set): First Round (first check-in), Explorer (5/10/all
    distinct bars — tiered), Regular (10 at one bar), Night Owl (after midnight),
    Neighborhood Champ. 
  - **Levels:** derived from total points via a curve (pure function).
  - **Leaderboards:** friends + neighborhood (global), windows *this week* / *all-time*,
    ranked from `points_ledger`.
- **Friends:** search by @username → request → accept/decline in `/friends` → accepted
  friends' check-ins aggregate into `/feed` (reverse-chron). Unfriend supported.

## 8. Build sequence (agent teams)

**Phase 0 — Foundation (serial, one team, lands first).** Postgres + Drizzle +
connection; the full schema + migrations (frozen contract); Better Auth (email/pw +
Google) + session helpers + route protection; login/signup/onboarding pages;
auth-aware header shell; seed badge definitions; de-risk Next 16 integration.
*Deliverable: a logged-in user with a profile row.*

**Phase 1 — Parallel teams (build against frozen schema).**
- **Team A — Profiles & Favorites:** profile view/edit, avatar upload, public
  `/u/[username]`, favorites star + list pinning.
- **Team B — Check-ins & Gamification engine:** check-in write path + cooldown,
  `lib/gamification` (points + badges + levels, pure + tested), badge case UI,
  points/level display. **Lands the check-in write + points ledger first** so C/D can
  integrate.
- **Team C — Friends & Feed:** requests/accept/decline, friends list, user search,
  `/feed`.
- **Team D — Leaderboards:** aggregate `points_ledger` over windows; friends +
  neighborhood views.

Because the schema is frozen in Phase 0, A/C/D can build UIs against seeded fixture data
in parallel; C's feed and D's leaderboard read what B writes, so B lands its write path
first.

**Phase 2 — Deferred:** check-ins → live counts via geolocation/`CountEvent`;
favorite-deal notifications; Apple login.

## 9. Testing & error handling

Mirrors the repo's existing culture (Vitest, pure-function tests like
`simulation.test.ts`, `deals.test.ts`):

- Unit tests for the gamification engine: points calc, badge criteria, level curve,
  cooldown logic.
- API tests for authorization: friend-only visibility, cooldown rejection, validation.
- Check-in + points + badge award occur in **one DB transaction** (atomic).
- Typed errors: 400 (validation), 401 (auth), 403 (friendship); loading/empty/error UI
  states consistent with current `app/page.tsx`.
- Migrations checked into the repo.

## 10. Open items to confirm at implementation time

- Managed Postgres provider (Neon assumed; Supabase-DB also fine).
- Exact points values + cooldown window (tunable config; defaults proposed above).
- Final badge list + icons.
