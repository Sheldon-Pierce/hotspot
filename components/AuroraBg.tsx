"use client";

import dynamic from "next/dynamic";

// three.js touches WebGL/window, so the Aurora must not server-render.
// This client wrapper lets server pages drop in the showpiece safely, and
// keeps `three` out of the shared bundle (only loaded where used).
const Aurora = dynamic(() => import("@/components/Aurora"), { ssr: false });

export default function AuroraBg({ variant }: { variant?: "full" | "header" }) {
  return <Aurora variant={variant} />;
}
