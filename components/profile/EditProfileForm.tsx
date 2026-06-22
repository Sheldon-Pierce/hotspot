"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import type { Profile } from "@/lib/profile/queries";

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-[var(--muted)]">Display name</label>
      <input
        name="displayName"
        defaultValue={profile.displayName}
        required
        className="glass rounded-[var(--r-control)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      <label className="text-sm text-[var(--muted)]">Bio</label>
      <textarea
        name="bio"
        defaultValue={profile.bio ?? ""}
        rows={3}
        maxLength={280}
        className="glass rounded-[var(--r-control)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      <label className="text-sm text-[var(--muted)]">Avatar URL (optional)</label>
      <input
        name="avatarUrl"
        defaultValue={profile.avatarUrl ?? ""}
        placeholder="https://…"
        className="glass rounded-[var(--r-control)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="glow rounded-[var(--r-control)] px-3 py-2.5 font-bold text-[#06060a] transition-transform hover:scale-[1.02] disabled:opacity-50"
        style={{ backgroundImage: "linear-gradient(135deg, var(--cyan), var(--magenta))", ["--glow" as string]: "rgba(255,45,120,.5)" }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
