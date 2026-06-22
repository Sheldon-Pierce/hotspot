import { describe, it, expect } from "vitest";
import * as schema from "@/lib/db/schema";

describe("schema", () => {
  it("exports all frozen-contract tables", () => {
    for (const name of [
      // Better Auth core (re-exported from auth-schema)
      "user", "session", "account", "verification",
      // App tables
      "profile", "favorite", "checkin", "friendship",
      "badge", "userBadge", "pointsLedger",
    ]) {
      expect(schema, `missing table export: ${name}`).toHaveProperty(name);
    }
  });
});
