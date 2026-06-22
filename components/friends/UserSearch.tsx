"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { sendFriendRequest } from "@/app/actions/friends";

type Found = { userId: string; username: string; displayName: string; avatarUrl: string | null };

function label(status: string | undefined): string {
  switch (status) {
    case "requested":
    case "already-requested":
      return "Requested";
    case "accepted":
    case "already-friends":
      return "Friends";
    default:
      return "Add";
  }
}

export default function UserSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  async function search(value: string) {
    setQ(value);
    if (value.trim().length === 0) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`);
    const body: { users: Found[] } = await res.json();
    setResults(body.users);
  }

  async function add(userId: string) {
    const { status } = await sendFriendRequest(userId);
    setStatuses((s) => ({ ...s, [userId]: status }));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or @username"
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <ul className="flex flex-col gap-2">
        {results.map((u) => (
          <li key={u.userId} className="flex items-center gap-3">
            <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
            <Link href={`/u/${u.username}`} className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-100">{u.displayName}</span>
              <span className="block truncate text-xs text-zinc-400">@{u.username}</span>
            </Link>
            <button
              onClick={() => add(u.userId)}
              disabled={!!statuses[u.userId]}
              className="ml-auto rounded-lg bg-amber-400 px-3 py-1 text-sm font-medium text-zinc-950 disabled:opacity-60"
            >
              {label(statuses[u.userId])}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
