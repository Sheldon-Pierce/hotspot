"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
        className="glass rounded-[var(--r-control)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      <div className="relative">
        <input
          name="password"
          type={showPw ? "text" : "password"}
          placeholder="Password"
          required
          minLength={8}
          className="glass w-full rounded-[var(--r-control)] px-3 py-2.5 pr-11 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
        />
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          aria-label={showPw ? "Hide password" : "Show password"}
          aria-pressed={showPw}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-base leading-none text-[var(--muted)] hover:text-white"
        >
          {showPw ? "🙈" : "👁️"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="glow rounded-[var(--r-control)] px-3 py-2.5 font-bold text-[#06060a] transition-transform hover:scale-[1.02] disabled:opacity-50"
        style={{ backgroundImage: "linear-gradient(135deg, var(--cyan), var(--magenta))", ["--glow" as string]: "rgba(255,45,120,.5)" }}
      >
        {pending ? "…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
