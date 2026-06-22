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
        set: {
          name: b.name,
          description: b.description,
          icon: b.icon,
          criteria: b.criteria,
        },
      });
  }
  console.log(`Seeded ${BADGES.length} badges.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
