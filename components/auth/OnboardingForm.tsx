"use client";

import { useActionState } from "react";
import { createProfile } from "@/app/actions/profile";

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(createProfile, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="username"
        placeholder="@username"
        required
        className="glass rounded-[var(--r-control)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      <input
        name="displayName"
        placeholder="Display name"
        required
        className="glass rounded-[var(--r-control)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="glow rounded-[var(--r-control)] px-3 py-2.5 font-bold text-[#06060a] transition-transform hover:scale-[1.02] disabled:opacity-50"
        style={{ backgroundImage: "linear-gradient(135deg, var(--cyan), var(--magenta))", ["--glow" as string]: "rgba(255,45,120,.5)" }}
      >
        {pending ? "…" : "Continue"}
      </button>
    </form>
  );
}
