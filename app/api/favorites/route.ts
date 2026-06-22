import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { favorite } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ favorites: [] });
  const rows = await db
    .select({ barId: favorite.barId })
    .from(favorite)
    .where(eq(favorite.userId, session.user.id));
  return NextResponse.json({ favorites: rows.map((r) => r.barId) });
}
