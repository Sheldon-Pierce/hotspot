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
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <input
        name="displayName"
        placeholder="Display name"
        required
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="rounded bg-orange-500 px-3 py-2 font-medium text-black disabled:opacity-50"
      >
        {pending ? "…" : "Continue"}
      </button>
    </form>
  );
}
