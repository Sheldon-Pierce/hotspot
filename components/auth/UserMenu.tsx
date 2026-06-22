"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

export default function UserMenu() {
  const { data } = useSession();
  const router = useRouter();

  if (!data?.user) {
    return (
      <Link href="/login" className="text-sm font-medium text-amber-400">
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/feed" className="font-medium text-zinc-200">
        Feed
      </Link>
      <Link href="/friends" className="font-medium text-zinc-200">
        Friends
      </Link>
      <Link href="/profile" className="font-medium text-zinc-200">
        Profile
      </Link>
      <button
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="text-zinc-400 hover:text-white"
      >
        Log out
      </button>
    </div>
  );
}
