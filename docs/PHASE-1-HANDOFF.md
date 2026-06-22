# Phase 1 Hand-off — Frozen Contract & Gotchas

Phase 0 (auth + DB foundation) is complete. Phase 1 feature teams build against
the frozen schema in `lib/db/schema.ts`. This doc captures the contract and a
few non-obvious points surfaced in the Phase 0 review.

## Shared helpers (build on these; don't reinvent)

- `@/lib/dal` — `getSession()`, `requireSession()` (redirects to `/login`),
  `getCurrentProfile()`. **Every** read/write of user data must re-derive
  identity here. The `proxy.ts` cookie check is optimistic pre-filtering only —
  never an authorization boundary.
- `@/lib/auth-client` — `signIn`, `signUp`, `signOut`, `useSession` (client).
- `@/lib/gamification/badges` — `BADGES` catalog; the engine keys awards off
  `BADGES[].key`. Definitions are already seeded (`npm run db:seed`).

## Frozen tables (see `lib/db/schema.ts`)

`user`/`session`/`account`/`verification` (Better Auth, in `auth-schema.ts`,
do not hand-edit) + `profile`, `favorite`, `checkin`, `friendship`, `badge`,
`user_badge`, `points_ledger`.

## Gotchas (from the Phase 0 review)

1. **Caller-supplied primary keys.** `checkin.id` and `points_ledger.id` are
   bare `text` PKs with **no DB default** — the writer must pass
   `crypto.randomUUID()`. (Team B owns these writes.)

2. **`friendship` is one-row-per-pair.** PK is `(requesterId, addresseeId)`;
   there is an index on `addresseeId`. Nothing enforces a canonical ordering,
   so the schema does NOT prevent an inverse duplicate `(B, A)`. Team C must
   either (a) canonicalize ordering on insert, or (b) always check/query BOTH
   directions for "are A and B friends?". A `status` enum (`pending`/`accepted`)
   tracks request state.

3. **`points_ledger` is append-only.** Aggregate `amount` over `createdAt`
   windows for leaderboards (`points_created_idx` supports this).
   `checkin_id` is `ON DELETE SET NULL` — deleting a check-in preserves the
   earned points.

4. **`session`/`account` `updated_at` have no DB default** (Better Auth
   populates them in app code on every write). Any RAW SQL insert into those
   tables (admin scripts, fixtures, backfills) must set `updated_at`
   explicitly or it will fail the NOT NULL.

5. **Check-in geolocation seam.** `checkin` has optional `lat`/`lng`, a
   `verification` enum (`honor` now, `geofence` reserved), and `source`
   (defaults `"check-in"`, matching `CountEvent.source` in `lib/types.ts`).
   Phase 2 will use these to verify presence and feed live crowd counts — keep
   check-in writes populating them where available.

## Known follow-ups (tracked)

- **Check-in cooldown is racy under concurrent double-submit** (`lib/checkins/record.ts`):
  the cooldown is a read-then-write at READ COMMITTED with no lock, so two
  near-simultaneous check-ins at the same bar can both pass the 2h check and
  double-score. Low impact (a fast double-click; the button is `pending`-guarded
  client-side). Fix when convenient: `SELECT … FOR UPDATE`, a coarse time-bucket
  unique index, or `pg_advisory_xact_lock(hash(userId, barId))` at the top of the
  transaction. Surfaced in the Phase 1B review.

## Still open (decided by the product owner)

- **Email verification:** spec §7 requires it for email/password; Phase 0 left
  it disabled pending a decision on an email-sending provider. See the spec's
  non-goals / project notes for the current status.
