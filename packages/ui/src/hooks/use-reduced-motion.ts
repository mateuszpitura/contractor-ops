'use client';

import { useEffect, useState } from 'react';

/**
 * Reads `prefers-reduced-motion: reduce`. Returns false during SSR and
 * on the first client render so server output is stable; flips to the
 * real value after mount.
 *
 * Animated primitives in @contractor-ops/ui MUST consult this hook —
 * the universal CSS rule in motion.css disables animations, but JS-driven
 * effects (rAF loops, mouse tracking) need an explicit opt-out.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
