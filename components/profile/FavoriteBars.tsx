import { barName } from "@/lib/favorites";

export default function FavoriteBars({ barIds }: { barIds: string[] }) {
  const named = barIds
    .map((id) => ({ id, name: barName(id) }))
    .filter((b): b is { id: string; name: string } => b.name !== null);

  if (named.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No favorite bars yet.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {named.map((b) => (
        <li
          key={b.id}
          className="glass rounded-full px-3 py-1 text-sm text-zinc-200"
        >
          <span className="text-[var(--amber)]">★</span> {b.name}
        </li>
      ))}
    </ul>
  );
}
