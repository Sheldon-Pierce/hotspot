import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

type DB = PostgresJsDatabase<typeof schema>;

// Reuse the client/instance across hot-reloads in dev.
const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _db?: DB;
};

function getDb(): DB {
  if (globalForDb._db) return globalForDb._db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = globalForDb._pgClient ?? postgres(connectionString, { max: 10 });
  const instance = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb._pgClient = client;
    globalForDb._db = instance;
  }
  return instance;
}

/**
 * Lazy Drizzle client. Importing this module is SIDE-EFFECT-FREE: the
 * connection (and the DATABASE_URL requirement) is created only on first use,
 * so `next build` page-data collection can import route modules without a
 * database present. Throws at first query if DATABASE_URL is unset.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
