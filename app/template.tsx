"use client";
import { motion } from "framer-motion";

// Wraps every route; a subtle fade on navigation. Framer Motion respects
// prefers-reduced-motion globally, and globals.css also clamps transitions.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
}
