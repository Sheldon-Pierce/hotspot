"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import type { Profile } from "@/lib/profile/queries";

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-zinc-400">Display name</label>
      <input
        name="displayName"
        defaultValue={profile.displayName}
        required
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <label className="text-sm text-zinc-400">Bio</label>
      <textarea
        name="bio"
        defaultValue={profile.bio ?? ""}
        rows={3}
        maxLength={280}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <label className="text-sm text-zinc-400">Avatar URL (optional)</label>
      <input
        name="avatarUrl"
        defaultValue={profile.avatarUrl ?? ""}
        placeholder="https://…"
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="rounded bg-amber-400 px-3 py-2 font-medium text-zinc-950 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
