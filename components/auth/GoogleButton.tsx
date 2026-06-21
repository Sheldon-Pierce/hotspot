"use client";

import { signIn } from "@/lib/auth-client";

export default function GoogleButton() {
  return (
    <button
      onClick={() => signIn.social({ provider: "google", callbackURL: "/onboarding" })}
      className="rounded border border-zinc-700 px-3 py-2 font-medium"
    >
      Continue with Google
    </button>
  );
}
