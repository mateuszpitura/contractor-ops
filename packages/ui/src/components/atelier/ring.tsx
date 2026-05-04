import type { ReactNode } from 'react';

export interface RingProps {
  value: number;
  max: number;
  /** Stroke color for the progress arc. Pass a CSS color or var(). */
  color: string;
  /** Outer dimension in px. Default 48. */
  size?: number;
  /** Stroke width in px. Default 3.5. */
  stroke?: number;
  /** Optional center content (label, icon). Visually centered. */
  children?: ReactNode;
}

/**
 * SVG progress ring. Static — no animation; safe to use in any
 * intensity tier and under reduced-motion without changes.
 *
 * **A11y:** SVG is `aria-hidden`. Meaningful state must be expressed
 * in adjacent text or via the parent's `aria-label`.
 */
export function Ring({ value, max, color, size = 48, stroke = 3.5, children }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max === 0 ? 0 : Math.min(value / max, 1);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
