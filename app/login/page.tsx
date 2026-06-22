import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import GoogleButton from "@/components/auth/GoogleButton";
import AuroraBg from "@/components/AuroraBg";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export default function LoginPage() {
  return (
    <>
      <AuroraBg variant="full" />
      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-6">
          <h1 className="neon-text text-2xl font-extrabold text-white">Log in to HotSpot</h1>
          <AuthForm mode="login" />
          {googleEnabled && <GoogleButton />}
          <p className="text-sm text-[var(--muted)]">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-[var(--cyan)]">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
