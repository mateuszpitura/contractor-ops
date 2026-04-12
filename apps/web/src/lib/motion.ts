import type { Transition, Variants } from "motion/react";

/**
 * Spring presets — physics-based motion that feels natural.
 * Use instead of duration + easing for interactive elements.
 */
export const springs = {
  /** Buttons, toggles, small state changes */
  snappy: {
    type: "spring",
    stiffness: 500,
    damping: 30,
    mass: 1,
  },

  /** Cards, panels opening, dropdowns */
  responsive: {
    type: "spring",
    stiffness: 300,
    damping: 28,
    mass: 1,
  },

  /** Page transitions, large layout shifts */
  gentle: {
    type: "spring",
    stiffness: 200,
    damping: 25,
    mass: 1.2,
  },

  /** Celebratory moments — success, achievements */
  bouncy: {
    type: "spring",
    stiffness: 400,
    damping: 15,
    mass: 1,
  },

  /** Slow, dramatic reveals */
  molasses: {
    type: "spring",
    stiffness: 120,
    damping: 20,
    mass: 1.5,
  },
} as const satisfies Record<string, Transition>;

/**
 * Stagger presets — cascade entrance for lists and grids.
 * Use as `transition` on a parent `motion.div` with `variants`.
 */
export const stagger = {
  /** Dense lists, table rows */
  fast: { staggerChildren: 0.03 },

  /** Cards, dashboard items */
  default: { staggerChildren: 0.06 },

  /** Hero sections, feature spotlights */
  slow: { staggerChildren: 0.12 },
} as const;

/**
 * Reusable variant sets for common animation patterns.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};
