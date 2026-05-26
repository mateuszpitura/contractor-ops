/**
 * Motion (Framer Motion → motion/react) spring + stagger + variant
 * presets. Lifted from apps/web/src/lib/motion.ts unchanged.
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

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};
