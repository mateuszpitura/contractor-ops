'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion.js';

export interface AnimatedNumberProps {
  /** Target value to count up to. Tweens whenever this changes. */
  value: number;
  /** Tween duration in ms. Default 1600. */
  duration?: number;
  /** Format function applied to each frame's integer value. Locale-neutral
   *  by default (Number.prototype.toLocaleString with no args); pass an
   *  Intl.NumberFormat-bound formatter for currency or specific locale. */
  format?: (n: number) => string;
}

/**
 * Counts from 0 to `value` over `duration` ms with an easing curve.
 * Honors prefers-reduced-motion: jumps directly to the target value
 * with no rAF loop when the user opts out of motion.
 *
 * **A11y:** This component is silent. The parent must carry an
 * `aria-label` describing the destination value so AT users hear the
 * final state, not the intermediate animation frames.
 *
 * **i18n:** No locale hardcoded. Provide a `format` function bound to
 * an Intl.NumberFormat (e.g. via useCurrencyFormatter) when displaying
 * currency. Default formatter calls `n.toLocaleString()` which uses the
 * runtime's locale and is non-deterministic across SSR/CSR — pass
 * `format` explicitly for stable output.
 */
export function AnimatedNumber({ value, duration = 1600, format }: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const frameRef = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally excludes `display` so a mid-tween value bump doesn't retrigger and visually jump
  useEffect(() => {
    if (reducedMotion || value === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const startValue = display;
    const delta = value - startValue;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // Exponential ease-out — fast initial, gentle settle.
      const eased = p === 1 ? 1 : 1 - 2 ** (-12 * p);
      setDisplay(Math.round(startValue + eased * delta));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, reducedMotion]);

  return <>{format ? format(display) : display.toLocaleString()}</>;
}
