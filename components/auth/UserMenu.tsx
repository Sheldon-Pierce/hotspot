"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

export default function UserMenu() {
  const { data } = useSession();
  const router = useRouter();

  if (!data?.user) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-[var(--hair)] bg-white/5 px-3 py-1 text-sm font-semibold text-[var(--cyan)] transition-colors hover:text-white"
      >
        Log in
      </Link>
    );
  }

  const link = "text-zinc-400 transition-colors hover:text-white";
  return (
    <nav className="flex items-center gap-3 text-sm font-medium">
      <Link href="/feed" className={link}>
        Feed
      </Link>
      <Link href="/friends" className={link}>
        Friends
      </Link>
      <Link href="/leaderboard" className={link}>
        Leaderboard
      </Link>
      <Link
        href="/profile"
        className="rounded-full bg-gradient-to-br from-[var(--cyan)] to-[var(--magenta)] px-3 py-1 font-semibold text-[#06060a]"
      >
        Profile
      </Link>
      <button
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className={link}
      >
        Log out
      </button>
    </nav>
  );
}
