'use client';

import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { useHoverCapability } from '../../hooks/use-hover-capability.js';
import { useReducedMotion } from '../../hooks/use-reduced-motion.js';
import { useAtelierIntensity } from './intensity-provider.js';

export interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /**
   * Animated entrance delay, in ms. Mapped to `animation-delay`.
   * Use for staggered card reveals. Ignored when `entrance` is false.
   */
  delay?: number;
  /**
   * Play the `atelier-enter` blur/scale entrance on mount. Default true.
   * Set false when a parent owns the entrance (e.g. an `AnimateIn` wrapper
   * in web-vite) so the card does not animate twice — the leftover
   * glass/tilt/glow/shimmer behaviour is unaffected.
   */
  entrance?: boolean;
  /** Apply atelier-border-glow (breathing teal→amber border). */
  glow?: boolean;
  /** Apply atelier-shimmer (metallic sweep on hover). */
  shimmer?: boolean;
  style?: CSSProperties;
}

/**
 * Atelier tilt card — frosted-glass surface with cursor-following 3D
 * tilt on hover. Becomes a static card in any of these conditions:
 *
 *   - intensity === 'workbench' (perf rule: no per-card tilt on dense pages)
 *   - prefers-reduced-motion: reduce
 *   - !(hover: hover) (touch / coarse pointer)
 *
 * Always renders the atelier-glass surface, optional border-glow,
 * optional shimmer. The `atelier-enter` entrance plays by default but is
 * opt-out via `entrance={false}` (when a parent owns the reveal). The
 * tilt-on-hover is the only behavior gated by capability.
 */
export function TiltCard({
  children,
  className = '',
  delay = 0,
  entrance = true,
  glow = false,
  shimmer = false,
  style,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const intensity = useAtelierIntensity();
  const reducedMotion = useReducedMotion();
  const canHover = useHoverCapability();

  const tiltActive = !reducedMotion && canHover && intensity !== 'workbench';

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!tiltActive) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${y * -4}deg) translateY(-2px)`;
    },
    [tiltActive],
  );

  const handleMouseLeave = useCallback(() => {
    if (!tiltActive) return;
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateY(0px)';
  }, [tiltActive]);

  const classes = [
    entrance ? 'atelier-enter' : '',
    'atelier-glass relative rounded-2xl p-5',
    tiltActive ? 'transition-transform duration-[400ms]' : '',
    glow ? 'atelier-border-glow' : '',
    shimmer ? 'atelier-shimmer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const _composedStyle: CSSProperties = {
    ...style,
    animationDelay: entrance && delay > 0 ? `${delay}ms` : undefined,
    transitionTimingFunction: tiltActive ? 'var(--ease-atelier-out)' : undefined,
    willChange: tiltActive ? 'transform' : undefined,
  };

  // The mouse handlers are decorative (visual tilt only); the card
  // itself is not a button. role="presentation" tells AT to ignore them.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: visual-only mousemove handlers, not interactive
    <div
      ref={ref}
      role="presentation"
      className={classes}
      onMouseMove={tiltActive ? handleMouseMove : undefined}
      onMouseLeave={tiltActive ? handleMouseLeave : undefined}>
      {children}
    </div>
  );
}
