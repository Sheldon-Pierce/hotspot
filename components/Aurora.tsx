"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

function Blobs() {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.15) * 0.15;
  });
  const blob = (x: number, y: number, color: string, scale: number) => (
    <mesh position={[x, y, 0]} scale={scale}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
    </mesh>
  );
  return (
    <group ref={g}>
      {blob(-1.4, 0.8, "#ff2d78", 2.2)}
      {blob(1.6, 1.0, "#22d3ee", 1.9)}
      {blob(0.2, -0.3, "#7c3aed", 1.5)}
    </group>
  );
}

const STATIC_BG =
  "radial-gradient(60% 50% at 28% 0%, rgba(255,45,120,.35), transparent), radial-gradient(50% 42% at 82% 4%, rgba(34,211,238,.28), transparent), radial-gradient(40% 40% at 55% 30%, rgba(124,58,237,.25), transparent)";

/**
 * The one three.js showpiece: an animated neon aurora. Lazy (import via
 * next/dynamic ssr:false), reduced-motion/no-WebGL safe via a static gradient.
 * `full` = fixed full-viewport (auth); `header` = absolute, dimmer (map header).
 */
export default function Aurora({ variant = "full" }: { variant?: "full" | "header" }) {
  const reduced = useReducedMotion();
  const cls =
    variant === "full" ? "fixed inset-0 -z-10" : "pointer-events-none absolute inset-0 -z-10 opacity-60";

  if (reduced) {
    return <div className={cls} style={{ background: STATIC_BG }} aria-hidden />;
  }
  return (
    <div className={cls} aria-hidden style={{ filter: "blur(64px)" }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5] }} gl={{ antialias: false }}>
        <Blobs />
      </Canvas>
    </div>
  );
}
