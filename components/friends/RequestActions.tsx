"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToRequest } from "@/app/actions/friends";

export default function RequestActions({ requesterId }: { requesterId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function respond(action: "accept" | "decline") {
    setPending(true);
    await respondToRequest(requesterId, action);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond("accept")}
        disabled={pending}
        className="rounded-lg bg-amber-400 px-3 py-1 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => respond("decline")}
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
