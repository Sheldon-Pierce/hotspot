"use client";

import { TIME_PRESETS } from "@/lib/presets";

interface HeaderProps {
  view: "list" | "map";
  onViewChange: (view: "list" | "map") => void;
  preset: string | null;
  onPresetChange: (preset: string | null) => void;
}

export default function Header({
  view,
  onViewChange,
  preset,
  onPresetChange,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight text-amber-400">
            🔥 HotSpot
          </h1>
          <p className="text-xs text-zinc-400">
            live bar crowds &middot; Ballard, Seattle
          </p>
        </div>

        <select
          value={preset ?? "live"}
          onChange={(e) =>
            onPresetChange(e.target.value === "live" ? null : e.target.value)
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
          aria-label="Time"
        >
          <option value="live">● Live now</option>
          {TIME_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              ⏩ {p.label}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-sm">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`rounded-md px-4 py-1 capitalize transition-colors ${
                view === v
                  ? "bg-amber-400 font-semibold text-zinc-950"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
