"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeFriend } from "@/app/actions/friends";

export default function RemoveFriendButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      onClick={async () => {
        setPending(true);
        await removeFriend(userId);
        router.refresh();
      }}
      disabled={pending}
      className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
    >
      Remove
    </button>
  );
}
