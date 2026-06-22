import { barName } from "@/lib/favorites";
import { timeAgo } from "@/lib/timeAgo";
import type { FeedItem } from "@/lib/friends/queries";

export default function RecentCheckins({
  visible,
  items,
}: {
  visible: boolean;
  items: FeedItem[];
}) {
  if (!visible) {
    return <p className="text-sm text-zinc-500">Check-ins are visible to friends.</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No check-ins yet.</p>;
  }
  const now = new Date();
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-200">{barName(item.barId) ?? "a bar"}</span>
          <span className="text-xs text-zinc-500">{timeAgo(item.createdAt, now)}</span>
        </li>
      ))}
    </ul>
  );
}
