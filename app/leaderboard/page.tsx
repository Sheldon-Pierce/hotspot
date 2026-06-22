import { requireSession } from "@/lib/dal";
import { getLeaderboard } from "@/lib/leaderboard/queries";
import type { LeaderboardScope, LeaderboardWindow } from "@/lib/leaderboard/window";
import Avatar from "@/components/Avatar";
import Toggle from "@/components/leaderboard/Toggle";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; window?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const scope: LeaderboardScope = sp.scope === "friends" ? "friends" : "neighborhood";
  const window: LeaderboardWindow = sp.window === "all" ? "all" : "week";

  const rows = await getLeaderboard(scope, window, session.user.id, new Date());

  const href = (next: Partial<{ scope: string; window: string }>) =>
    `/leaderboard?scope=${next.scope ?? scope}&window=${next.window ?? window}`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <div className="flex flex-wrap gap-3">
        <Toggle
          options={[
            { value: "neighborhood", label: "Neighborhood" },
            { value: "friends", label: "Friends" },
          ]}
          current={scope}
          hrefFor={(v) => href({ scope: v })}
        />
        <Toggle
          options={[
            { value: "week", label: "This week" },
            { value: "all", label: "All-time" },
          ]}
          current={window}
          hrefFor={(v) => href({ window: v })}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No points yet. Check in to a bar to get on the board.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.userId}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                r.userId === session.user.id
                  ? "border-amber-500/50 bg-amber-400/10"
                  : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <span className="w-6 shrink-0 text-center font-bold tabular-nums text-zinc-400">
                {r.rank}
              </span>
              <Avatar name={r.displayName} src={r.avatarUrl} size={36} />
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-100">{r.displayName}</span>
                <span className="block truncate text-xs text-zinc-400">@{r.username}</span>
              </div>
              <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-amber-300">
                {r.points}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
