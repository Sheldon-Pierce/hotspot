import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import OnboardingForm from "@/components/auth/OnboardingForm";

export default async function OnboardingPage() {
  await requireSession();
  if (await getCurrentProfile()) redirect("/profile");

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Pick your handle</h1>
      <p className="text-sm text-zinc-400">
        This is how friends will find you on HotSpot.
      </p>
      <OnboardingForm />
    </main>
  );
}
