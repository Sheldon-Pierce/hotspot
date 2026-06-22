"use client";
import { useReducedMotion } from "framer-motion";

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const card = {
  rest: { y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } },
};

export function useReduced() {
  return useReducedMotion();
}
