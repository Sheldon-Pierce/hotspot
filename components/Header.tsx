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
  const isLive = preset === null;
  return (
    <div className="relative z-[1] border-b border-[var(--hair)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="mr-auto inline-flex items-center gap-2 text-xs text-[var(--muted)]">
          <span
            className={`h-2 w-2 rounded-full ${isLive ? "animate-pulse" : ""}`}
            style={{ background: isLive ? "var(--green)" : "var(--faint)", boxShadow: isLive ? "0 0 8px var(--green)" : "none" }}
          />
          {isLive ? "Live now" : "Time-travel"} &middot; Ballard, Seattle
        </span>

        <select
          value={preset ?? "live"}
          onChange={(e) =>
            onPresetChange(e.target.value === "live" ? null : e.target.value)
          }
          className="glass rounded-[var(--r-control)] px-3 py-1.5 text-sm text-[var(--text)]"
          aria-label="Time"
        >
          <option value="live">● Live now</option>
          {TIME_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              ⏩ {p.label}
            </option>
          ))}
        </select>

        <div className="glass flex rounded-[var(--r-control)] p-0.5 text-sm">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`rounded-md px-4 py-1 capitalize transition-colors ${
                view === v
                  ? "font-semibold text-[#06060a]"
                  : "text-[var(--muted)] hover:text-white"
              }`}
              style={view === v ? { background: "var(--amber)", boxShadow: "0 0 16px -2px var(--amber)" } : undefined}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
