import Link from "next/link";
import { requireSession } from "@/lib/dal";
import { getFriendsFeed } from "@/lib/friends/queries";
import { barName } from "@/lib/favorites";
import { timeAgo } from "@/lib/timeAgo";
import Avatar from "@/components/Avatar";

export default async function FeedPage() {
  const session = await requireSession();
  const items = await getFriendsFeed(session.user.id);
  const now = new Date();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Feed</h1>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No check-ins yet.{" "}
          <Link href="/friends" className="text-amber-400">
            Add friends
          </Link>{" "}
          to see where they&apos;re out.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <Avatar name={item.displayName} src={item.avatarUrl} size={40} />
              <p className="min-w-0 text-sm text-zinc-200">
                <Link href={`/u/${item.username}`} className="font-semibold">
                  {item.displayName}
                </Link>{" "}
                checked in at{" "}
                <span className="font-medium text-amber-300">{barName(item.barId) ?? "a bar"}</span>
              </p>
              <span className="ml-auto shrink-0 text-xs text-zinc-500">
                {timeAgo(item.createdAt, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
