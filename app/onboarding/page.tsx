import { redirect } from "next/navigation";
import { requireSession, getCurrentProfile } from "@/lib/dal";
import OnboardingForm from "@/components/auth/OnboardingForm";
import AuroraBg from "@/components/AuroraBg";

export default async function OnboardingPage() {
  await requireSession();
  if (await getCurrentProfile()) redirect("/profile");

  return (
    <>
      <AuroraBg variant="full" />
      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-6">
          <h1 className="neon-text text-2xl font-extrabold text-white">Pick your handle</h1>
          <p className="text-sm text-[var(--muted)]">
            This is how friends will find you on HotSpot.
          </p>
          <OnboardingForm />
        </div>
      </main>
    </>
  );
}
