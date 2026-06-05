/**
 * Motion (Framer Motion → motion/react) spring + stagger + variant
 * presets.
 */

import type { Transition, Variants } from 'motion/react';

export const springs = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 1 },
  responsive: { type: 'spring', stiffness: 300, damping: 28, mass: 1 },
  gentle: { type: 'spring', stiffness: 200, damping: 25, mass: 1.2 },
  bouncy: { type: 'spring', stiffness: 400, damping: 15, mass: 1 },
  molasses: { type: 'spring', stiffness: 120, damping: 20, mass: 1.5 },
} as const satisfies Record<string, Transition>;

export const stagger = {
  fast: { staggerChildren: 0.03 },
  default: { staggerChildren: 0.06 },
  slow: { staggerChildren: 0.12 },
} as const;

// Entrance variant for `AnimateIn` — the single entrance system across the
// web-vite app. Opacity + short slide only: no `filter: blur`, which compounds
// badly when an AnimateIn wrapper nests over a card that also animates, and is
// expensive on the GPU during a staggered multi-widget reveal.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};
