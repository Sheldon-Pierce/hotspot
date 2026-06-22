"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkIn, type CheckInResult } from "@/app/actions/checkin";

export default function CheckInButton({ barId, isLoggedIn }: { barId: string; isLoggedIn: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  async function onClick() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setPending(true);
    try {
      const r = await checkIn(barId);
      setResult(r);
      if (r.status === "ok") router.refresh(); // reflect new points/badges elsewhere
    } catch {
      setResult({ status: "error", message: "Check-in failed. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={onClick}
        disabled={pending}
        className="glow w-full rounded-[var(--r-card)] px-4 py-2.5 font-bold text-[#06060a] transition-transform hover:scale-[1.02] disabled:opacity-50"
        style={{ backgroundImage: "linear-gradient(135deg, var(--cyan), var(--magenta))", ["--glow" as string]: "rgba(255,45,120,.55)" }}
      >
        {pending ? "Checking in…" : "📍 I'm here — check in"}
      </button>
      {result?.status === "ok" && (
        <p className="mt-2 text-center text-sm text-emerald-300">
          +{result.pointsEarned} points! (level {result.level})
          {result.newBadges.length > 0 &&
            ` · New badge${result.newBadges.length > 1 ? "s" : ""}: ${result.newBadges
              .map((b) => `${b.icon} ${b.name}`)
              .join(", ")}`}
        </p>
      )}
      {result?.status === "cooldown" && (
        <p className="mt-2 text-center text-sm text-zinc-400">
          You already checked in here recently.
        </p>
      )}
      {result?.status === "error" && (
        <p className="mt-2 text-center text-sm text-red-400">{result.message}</p>
      )}
    </div>
  );
}
