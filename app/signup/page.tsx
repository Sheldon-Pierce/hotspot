import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import GoogleButton from "@/components/auth/GoogleButton";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export default function SignupPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Join HotSpot</h1>
      <AuthForm mode="signup" />
      {googleEnabled && <GoogleButton />}
      <p className="text-sm text-zinc-400">
        Have an account?{" "}
        <Link href="/login" className="text-orange-400">
          Log in
        </Link>
      </p>
    </main>
  );
}
