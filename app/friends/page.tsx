import Link from "next/link";
import { requireSession } from "@/lib/dal";
import { getIncomingRequests, getFriends } from "@/lib/friends/queries";
import Avatar from "@/components/Avatar";
import RequestActions from "@/components/friends/RequestActions";
import RemoveFriendButton from "@/components/friends/RemoveFriendButton";
import UserSearch from "@/components/friends/UserSearch";

export default async function FriendsPage() {
  const session = await requireSession();
  const [incoming, friends] = await Promise.all([
    getIncomingRequests(session.user.id),
    getFriends(session.user.id),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-3">
        <h1 className="neon-text text-2xl font-extrabold text-white">Friends</h1>
        <UserSearch />
      </section>

      {incoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Requests ({incoming.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {incoming.map((p) => (
              <li key={p.userId} className="glass flex items-center gap-3 rounded-[var(--r-card)] p-3">
                <Avatar name={p.displayName} src={p.avatarUrl} size={36} />
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">{p.displayName}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">@{p.username}</span>
                </div>
                <div className="ml-auto">
                  <RequestActions requesterId={p.userId} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-zinc-500">No friends yet — search above to add some.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((p) => (
              <li key={p.userId} className="glass flex items-center gap-3 rounded-[var(--r-card)] p-3">
                <Avatar name={p.displayName} src={p.avatarUrl} size={36} />
                <Link href={`/u/${p.username}`} className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">{p.displayName}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">@{p.username}</span>
                </Link>
                <div className="ml-auto">
                  <RemoveFriendButton userId={p.userId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
