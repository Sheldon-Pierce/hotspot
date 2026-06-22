import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import { getEarnedBadges, getFavoriteBarIds, getCheckinSummary } from "@/lib/profile/queries";
import ProfileView from "@/components/profile/ProfileView";

export default async function ProfilePage() {
  const session = await requireSession();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const [badges, favoriteBarIds, checkins] = await Promise.all([
    getEarnedBadges(session.user.id),
    getFavoriteBarIds(session.user.id),
    getCheckinSummary(session.user.id),
  ]);

  return (
    <ProfileView
      profile={profile}
      badges={badges}
      favoriteBarIds={favoriteBarIds}
      checkins={checkins}
      isOwner
    />
  );
}
