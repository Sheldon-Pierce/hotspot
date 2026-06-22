import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import GoogleButton from "@/components/auth/GoogleButton";
import AuroraBg from "@/components/AuroraBg";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export default function SignupPage() {
  return (
    <>
      <AuroraBg variant="full" />
      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-6">
          <h1 className="neon-text text-2xl font-extrabold text-white">Join HotSpot</h1>
          <AuthForm mode="signup" />
          {googleEnabled && <GoogleButton />}
          <p className="text-sm text-[var(--muted)]">
            Have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--cyan)]">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
