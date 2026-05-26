/**
 * Spring-based fade-up wrapper. Step 11 codemod port from
 * apps/web/src/components/shared/animate-in.tsx:
 *   - `@/lib/motion` → `../../lib/motion.js`
 *   - `@/lib/utils`  → `../../lib/utils.js`
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { fadeUp, springs } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';

interface AnimateInProps {
  children: ReactNode;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const DELAY_MS = [0, 0.06, 0.12, 0.18, 0.24, 0.3] as const;

export function AnimateIn({ children, delay = 0, className }: AnimateInProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      transition={{ ...springs.gentle, delay: DELAY_MS[delay] }}
      className={cn('min-w-0', className)}>
      {children}
    </motion.div>
  );
}
