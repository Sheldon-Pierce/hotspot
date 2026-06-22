"use client";

import type { BarStatus } from "@/lib/types";
import { LEVEL_META, TREND_META } from "@/lib/ui";

interface BarListProps {
  bars: BarStatus[];
  favorites: Set<string>;
  onSelect: (barId: string) => void;
  onToggleFavorite: (barId: string) => void;
}

/** Favorites first, then open busiest-first, closed at the bottom. */
function sortBars(bars: BarStatus[], favorites: Set<string>): BarStatus[] {
  return [...bars].sort((a, b) => {
    const af = favorites.has(a.bar.id);
    const bf = favorites.has(b.bar.id);
    if (af !== bf) return af ? -1 : 1;
    if (a.open !== b.open) return a.open ? -1 : 1;
    return b.ratio - a.ratio;
  });
}

export default function BarList({ bars, favorites, onSelect, onToggleFavorite }: BarListProps) {
  return (
    <ul className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-4">
      {sortBars(bars, favorites).map((status) => {
        const { bar } = status;
        const meta = LEVEL_META[status.level];
        const trendMeta = TREND_META[status.trend];
        const incentive = status.deals.find((d) => d.type === "incentive");
        const fav = favorites.has(bar.id);
        return (
          <li key={bar.id} className="relative">
            <button
              onClick={() => onSelect(bar.id)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 pr-12 text-left transition-colors hover:border-zinc-600"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="truncate font-semibold text-zinc-100">{bar.name}</span>
                {incentive && (
                  <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    🎁 {incentive.title}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-sm tabular-nums text-zinc-300">
                  {status.open ? (
                    <>
                      <span className="font-semibold text-zinc-100">{status.count}</span>
                      <span className="text-zinc-500"> / {bar.capacity}</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">Closed</span>
                  )}
                </span>
              </div>

              {status.open && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, status.ratio * 100)}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-xs text-zinc-400">
                    {meta.label} {trendMeta.icon} {trendMeta.label}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => onToggleFavorite(bar.id)}
              className="absolute right-3 top-3 rounded-full p-1 text-lg leading-none"
              aria-label={fav ? `Unfavorite ${bar.name}` : `Favorite ${bar.name}`}
              aria-pressed={fav}
            >
              <span className={fav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}>
                {fav ? "★" : "☆"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
