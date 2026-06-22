"use client";

import type { BarStatus } from "@/lib/types";
import { LEVEL_META, TREND_META } from "@/lib/ui";
import Sparkline from "@/components/Sparkline";
import CheckInButton from "@/components/CheckInButton";
import HeatMeter from "@/components/ui/HeatMeter";

interface BarDetailProps {
  status: BarStatus;
  isFavorite: boolean;
  isLoggedIn: boolean;
  onToggleFavorite: (barId: string) => void;
  onClose: () => void;
}

export default function BarDetail({ status, isFavorite, isLoggedIn, onToggleFavorite, onClose }: BarDetailProps) {
  const { bar } = status;
  const meta = LEVEL_META[status.level];
  const trendMeta = TREND_META[status.trend];

  return (
    <>
      <div
        className="fixed inset-0 z-[1200] bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <aside className="glass-strong fixed inset-x-0 bottom-0 z-[1300] max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-[var(--hair)] bg-[var(--bg-2)]/95 p-5 sm:inset-x-auto sm:right-4 sm:top-20 sm:bottom-4 sm:w-96 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{bar.name}</h2>
            <p className="text-sm text-[var(--muted)]">{bar.address}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleFavorite(bar.id)}
              className="rounded-full p-1 text-xl leading-none"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={isFavorite}
            >
              <span
                className={isFavorite ? "text-[var(--amber)]" : "text-[var(--faint)] hover:text-zinc-300"}
                style={isFavorite ? { textShadow: "0 0 10px var(--amber)" } : undefined}
              >
                {isFavorite ? "★" : "☆"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {bar.vibe.map((v) => (
            <span
              key={v}
              className="rounded-full bg-white/[.07] px-2 py-0.5 text-xs text-[var(--muted)]"
            >
              {v}
            </span>
          ))}
        </div>

        <section className="glass mt-4 rounded-[var(--r-card)] p-4">
          <div className="flex items-baseline justify-between">
            <span
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
            {status.open && (
              <span className="text-sm text-[var(--muted)]">
                <span className="text-xl font-bold tabular-nums text-zinc-100">
                  {status.count}
                </span>
                <span className="text-[var(--faint)]"> / {bar.capacity} people</span>
              </span>
            )}
          </div>
          {status.open ? (
            <>
              <div className="mt-3">
                <HeatMeter ratio={status.ratio} level={status.level} />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <Sparkline
                  points={status.history}
                  max={bar.capacity}
                  color={meta.color}
                />
                <span className="text-xs text-zinc-400">
                  {trendMeta.icon} {trendMeta.label}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">
              Opens at {bar.openHour > 12 ? bar.openHour - 12 : bar.openHour}
              {bar.openHour >= 12 ? " PM" : " AM"}
            </p>
          )}
        </section>

        {status.deals.length > 0 && (
          <section className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Active deals
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {status.deals.map((deal) => (
                <li
                  key={deal.type}
                  className={`rounded-xl border p-3 text-sm ${
                    deal.type === "incentive"
                      ? "border-emerald-500/40 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-500/40 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  <div className="font-semibold">
                    {deal.type === "incentive" ? "🎁" : "🍻"} {deal.title}
                  </div>
                  <div className="mt-0.5 opacity-90">{deal.description}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Menu highlights
          </h3>
          <ul className="glass mt-2 divide-y divide-[var(--hair)] rounded-[var(--r-card)]">
            {bar.menuHighlights.map((item) => (
              <li
                key={item.name}
                className="flex justify-between px-3 py-2 text-sm"
              >
                <span className="text-zinc-200">{item.name}</span>
                <span className="tabular-nums text-zinc-400">{item.price}</span>
              </li>
            ))}
          </ul>
          {bar.happyHour && (
            <p className="mt-2 text-xs text-zinc-400">
              Happy hour: {bar.happyHour.description}
            </p>
          )}
        </section>

        <CheckInButton barId={bar.id} isLoggedIn={isLoggedIn} />

        {bar.website ? (
          <a
            href={bar.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block rounded-xl bg-amber-400 px-4 py-2.5 text-center font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
          >
            Visit website ↗
          </a>
        ) : (
          <p className="mt-5 text-center text-xs text-zinc-500">
            No website — just show up.
          </p>
        )}
      </aside>
    </>
  );
}
