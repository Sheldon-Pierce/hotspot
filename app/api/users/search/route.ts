import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dal";
import { searchUsers } from "@/lib/friends/queries";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ users: [] });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchUsers(q, session.user.id);
  return NextResponse.json({
    users: results.map((p) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
    })),
  });
}
