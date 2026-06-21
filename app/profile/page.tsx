import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";

// Minimal profile landing for Phase 0: proves the auth gate (proxy + DAL)
// and the onboarding redirect target. Phase 1 (Team A) expands this with
// avatar, favorites, badge case, friends, and check-in history.
export default async function ProfilePage() {
  await requireSession();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 px-4 py-12">
      <h1 className="text-2xl font-bold">{profile.displayName}</h1>
      <p className="text-zinc-400">@{profile.username}</p>
      {profile.bio && <p>{profile.bio}</p>}
      <p className="text-sm text-orange-400">{profile.points} points</p>
    </main>
  );
}
