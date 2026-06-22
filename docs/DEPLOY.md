# Deploying HotSpot (production)

The crowd map (`/`, `/api/bars`) is stateless and works with no configuration.
**Auth, profiles, check-ins, friends, and leaderboards require a database and
auth secrets.** Without them, the app loads but signup/login return HTTP 500
(`DATABASE_URL is not set`). The whole app is gated behind login, so a
misconfigured deployment is effectively unusable — set these before sharing it.

## 1. Provision a Postgres database

Create a free managed Postgres (e.g. [Neon](https://neon.tech) or Supabase) and
copy its connection string (looks like `postgres://user:pass@host/db?sslmode=require`).

## 2. Set environment variables on the host

In Vercel: **Project → Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Postgres connection string from step 1 |
| `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | the deployment's origin, e.g. `https://hotspot-ochre.vercel.app` (must match exactly, or session cookies / OAuth callbacks break) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *(optional)* Google OAuth; email/password works without them |

## 3. Apply migrations + seed against the production DB

Run locally, pointed at the production database:

```bash
DATABASE_URL="<prod-connection-string>" npm run db:migrate
DATABASE_URL="<prod-connection-string>" npm run db:seed     # badge definitions
```

## 4. Redeploy

Vercel redeploys on push; or use **Redeploy** in the dashboard so the new env
vars take effect.

## 5. Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/api/bars   # 200 (stateless)
# Sign up via the UI, or:
curl -s -w "\n%{http_code}\n" -X POST https://<your-domain>/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password","name":"you"}'   # expect 200 + a Set-Cookie
```

If signup still 500s, check **Vercel → Logs** for the `/api/auth/...` function —
it names the missing piece (usually `DATABASE_URL`/`BETTER_AUTH_SECRET` or an
unmigrated database).

## Notes

- On https, Better Auth issues a `__Secure-better-auth.session_token` cookie
  (Secure flag) — correct for production. Over plain `http` it omits Secure so
  local dev works; don't serve production over http.
- `BETTER_AUTH_URL` mismatch is the most common post-setup failure: it must be
  the exact public origin.
