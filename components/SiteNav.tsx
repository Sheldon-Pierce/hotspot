import Link from "next/link";
import UserMenu from "@/components/auth/UserMenu";

// Persistent top nav on every page so you can always get back to the map.
// The home page renders its own map controls (view toggle, time presets)
// below this. Restyled by the redesign.
export default function SiteNav() {
  return (
    <header className="sticky top-0 z-[1100] border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-auto" aria-label="HotSpot — back to the map">
          <span className="text-xl font-bold tracking-tight text-amber-400">🔥 HotSpot</span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
