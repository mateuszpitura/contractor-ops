"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AnimateInProps {
  children: ReactNode;
  /** Stagger index (0-5) for animation delay */
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const DELAY_MS = [0, 0.06, 0.12, 0.18, 0.24, 0.3] as const;

/**
 * Wrapper that applies a spring-based fade-up entrance with blur.
 * Use delay={0..5} for sequential reveal of sibling elements.
 */
export function AnimateIn({ children, delay = 0, className }: AnimateInProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      transition={{ ...springs.gentle, delay: DELAY_MS[delay] }}
      className={cn("min-w-0", className)}
    >
      {children}
    </motion.div>
  );
}
