import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import EditProfileForm from "@/components/profile/EditProfileForm";

export default async function EditProfilePage() {
  await requireSession();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Edit profile</h1>
      <EditProfileForm profile={profile} />
    </main>
  );
}
