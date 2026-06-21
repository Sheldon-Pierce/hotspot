import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import GoogleButton from "@/components/auth/GoogleButton";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Log in to HotSpot</h1>
      <AuthForm mode="login" />
      {googleEnabled && <GoogleButton />}
      <p className="text-sm text-zinc-400">
        No account?{" "}
        <Link href="/signup" className="text-orange-400">
          Sign up
        </Link>
      </p>
    </main>
  );
}
