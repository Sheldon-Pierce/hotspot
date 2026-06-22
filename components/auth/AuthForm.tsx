"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));

    const res =
      mode === "signup"
        ? await signUp.email({ email, password, name: email.split("@")[0] })
        : await signIn.email({ email, password });

    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong.");
      return;
    }
    // New accounts have no profile yet → onboarding decides where to go.
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder="you@email.com"
        required
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        minLength={8}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="rounded bg-orange-500 px-3 py-2 font-medium text-black disabled:opacity-50"
      >
        {pending ? "…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
