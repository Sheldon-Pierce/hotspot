import Link from "next/link";
import Avatar from "@/components/Avatar";
import BadgeCase from "@/components/profile/BadgeCase";
import FavoriteBars from "@/components/profile/FavoriteBars";
import type { BadgeDef } from "@/lib/gamification/badges";
import type { Profile } from "@/lib/profile/queries";

interface ProfileViewProps {
  profile: Profile;
  badges: BadgeDef[];
  favoriteBarIds: string[];
  isOwner: boolean;
}

export default function ProfileView({ profile, badges, favoriteBarIds, isOwner }: ProfileViewProps) {
  const memberSince = profile.createdAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-4">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-zinc-100">{profile.displayName}</h1>
          <p className="text-zinc-400">@{profile.username}</p>
        </div>
        {isOwner && (
          <Link
            href="/profile/edit"
            className="ml-auto shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
          >
            Edit
          </Link>
        )}
      </header>

      {profile.bio && <p className="text-zinc-300">{profile.bio}</p>}

      <div className="flex flex-wrap gap-6 text-sm">
        <span className="text-amber-400">
          <span className="font-bold tabular-nums">{profile.points}</span> points
        </span>
        <span className="text-zinc-400">
          <span className="font-bold tabular-nums text-zinc-200">{favoriteBarIds.length}</span> favorites
        </span>
        <span className="text-zinc-500">Member since {memberSince}</span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Badges</h2>
        <BadgeCase badges={badges} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Favorite bars</h2>
        <FavoriteBars barIds={favoriteBarIds} />
      </section>
    </main>
  );
}
