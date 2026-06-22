import { notFound } from "next/navigation";
import { getSession } from "@/lib/dal";
import {
  getProfileByUsername,
  getEarnedBadges,
  getFavoriteBarIds,
  getCheckinSummary,
} from "@/lib/profile/queries";
import ProfileView from "@/components/profile/ProfileView";

// Next 16: route params are async.
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());
  if (!profile) notFound();

  const [badges, favoriteBarIds, session, checkins] = await Promise.all([
    getEarnedBadges(profile.userId),
    getFavoriteBarIds(profile.userId),
    getSession(),
    getCheckinSummary(profile.userId),
  ]);
  const isOwner = session?.user?.id === profile.userId;

  return (
    <ProfileView
      profile={profile}
      badges={badges}
      favoriteBarIds={favoriteBarIds}
      checkins={checkins}
      isOwner={isOwner}
    />
  );
}
