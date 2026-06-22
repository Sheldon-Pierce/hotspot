# Database (local development)

HotSpot's user/social/gamification features use Postgres (via Drizzle ORM).
The original crowd engine (`/api/bars`, the simulation) remains stateless and
does **not** need the database.

## 1. Run a local Postgres

```bash
docker run --name hotspot-pg \
  -e POSTGRES_USER=hotspot -e POSTGRES_PASSWORD=hotspot -e POSTGRES_DB=hotspot \
  -p 5432:5432 -d postgres:16
```

Stop / start later with `docker stop hotspot-pg` / `docker start hotspot-pg`.

## 2. Configure env

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
# generate a secret:
openssl rand -base64 32   # paste into BETTER_AUTH_SECRET
```

`DATABASE_URL` already matches the Docker command above. `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` are optional — email/password auth works without them.

## 3. Migrate & seed

```bash
npm run db:generate   # generate SQL migrations from lib/db/schema.ts
npm run db:migrate    # apply migrations to the database
npm run db:seed       # seed badge definitions
```

## Inspecting the database

```bash
docker exec -it hotspot-pg psql -U hotspot -d hotspot
```
