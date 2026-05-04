'use client';

import { useEffect, useState } from 'react';

/**
 * Reads `(hover: hover) and (pointer: fine)`. True on devices with a
 * fine-grained pointer that supports hover (desktop mice + trackpads).
 * False on touch (phones, tablets) and coarse pointers.
 *
 * JS-driven hover effects (TiltCard mouse tracking, custom shimmer
 * triggers) MUST consult this hook so they degrade gracefully on touch
 * instead of leaving touch users with broken-looking interactions.
 *
 * Returns false during SSR and on the first client render so server
 * output is stable; flips to the real value after mount.
 */
export function useHoverCapability(): boolean {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCanHover(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return canHover;
}
