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
