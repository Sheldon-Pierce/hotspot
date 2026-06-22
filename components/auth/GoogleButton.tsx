"use client";

import { signIn } from "@/lib/auth-client";

export default function GoogleButton() {
  return (
    <button
      onClick={() => signIn.social({ provider: "google", callbackURL: "/onboarding" })}
      className="glass rounded-[var(--r-control)] px-3 py-2.5 font-medium text-[var(--text)] transition-colors hover:border-white/20"
    >
      Continue with Google
    </button>
  );
}
