import { config } from "dotenv";

// Tests run outside Next.js, so load .env.local explicitly for anything
// that reads process.env (e.g. DATABASE_URL for the Drizzle client).
config({ path: ".env.local" });
