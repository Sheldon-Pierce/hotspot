"use client";

import { motion } from "framer-motion";
import type { BarStatus } from "@/lib/types";
import { LEVEL_META, TREND_META } from "@/lib/ui";
import { fadeUp, stagger } from "@/lib/motion";
import HeatMeter from "@/components/ui/HeatMeter";
import Pill from "@/components/ui/Pill";

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
    <motion.ul
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-3xl flex-col gap-2.5 px-4 py-4"
    >
      {sortBars(bars, favorites).map((status) => {
        const { bar } = status;
        const meta = LEVEL_META[status.level];
        const trendMeta = TREND_META[status.trend];
        const incentive = status.deals.find((d) => d.type === "incentive");
        const fav = favorites.has(bar.id);
        const packed = status.level === "packed";
        return (
          <motion.li key={bar.id} variants={fadeUp} className="relative">
            <motion.button
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              onClick={() => onSelect(bar.id)}
              className="glass w-full rounded-[var(--r-card)] p-4 pr-12 text-left"
              style={packed ? { boxShadow: "0 0 30px -8px var(--magenta)", borderColor: "rgba(255,45,120,.4)" } : undefined}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color, boxShadow: `0 0 10px ${meta.color}` }}
                  aria-hidden
                />
                <span className="truncate font-semibold text-zinc-100">{bar.name}</span>
                {incentive && <Pill tone="deal">🎁 {incentive.title}</Pill>}
                <span className="ml-auto shrink-0 text-sm tabular-nums">
                  {status.open ? (
                    <>
                      <span className="font-semibold text-zinc-100">{status.count}</span>
                      <span className="text-[var(--faint)]"> / {bar.capacity}</span>
                    </>
                  ) : (
                    <span className="text-[var(--faint)]">Closed</span>
                  )}
                </span>
              </div>

              {status.open && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <HeatMeter ratio={status.ratio} level={status.level} />
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: meta.color }}
                  >
                    {meta.label} {trendMeta.icon}{" "}
                    <span className="font-normal text-[var(--faint)]">{trendMeta.label}</span>
                  </span>
                </div>
              )}
            </motion.button>

            <button
              onClick={() => onToggleFavorite(bar.id)}
              className="absolute right-3 top-3 rounded-full p-1 text-lg leading-none"
              aria-label={fav ? `Unfavorite ${bar.name}` : `Favorite ${bar.name}`}
              aria-pressed={fav}
            >
              <span
                className={fav ? "text-[var(--amber)]" : "text-[var(--faint)] hover:text-zinc-300"}
                style={fav ? { textShadow: "0 0 10px var(--amber)" } : undefined}
              >
                {fav ? "★" : "☆"}
              </span>
            </button>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
