import type { BadgeDef } from "@/lib/gamification/badges";

export default function BadgeCase({ badges }: { badges: BadgeDef[] }) {
  if (badges.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No badges yet — check in to a bar to start earning.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-3">
      {badges.map((b) => (
        <li
          key={b.key}
          title={b.description}
          className="glass glow flex flex-col items-center gap-1 rounded-[var(--r-card)] px-3 py-2"
          style={{ ["--glow" as string]: "rgba(124,58,237,.4)" }}
        >
          <span className="text-2xl">{b.icon}</span>
          <span className="text-xs text-zinc-300">{b.name}</span>
        </li>
      ))}
    </ul>
  );
}
