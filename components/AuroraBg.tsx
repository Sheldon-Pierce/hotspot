"use client";

import dynamic from "next/dynamic";

// Shown instantly (and during the lazy chunk load) so the neon is present from
// first paint — the Canvas then swaps in seamlessly, with no dark→neon flash.
const STATIC_BG =
  "radial-gradient(60% 50% at 28% 0%, rgba(255,45,120,.35), transparent), radial-gradient(50% 42% at 82% 4%, rgba(34,211,238,.28), transparent), radial-gradient(40% 40% at 55% 30%, rgba(124,58,237,.25), transparent)";

// three.js touches WebGL/window, so the Aurora must not server-render.
// This client wrapper lets server pages drop in the showpiece safely, keeps
// `three` out of the shared bundle, and renders the static gradient until the
// Canvas is ready.
const Aurora = dynamic(() => import("@/components/Aurora"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10" style={{ background: STATIC_BG }} aria-hidden />,
});

export default function AuroraBg({ variant }: { variant?: "full" | "header" }) {
  return <Aurora variant={variant} />;
}
