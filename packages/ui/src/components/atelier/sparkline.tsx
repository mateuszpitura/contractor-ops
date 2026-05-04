'use client';

import { useId } from 'react';
import { useAtelierIntensity } from './intensity-provider.js';

export interface SparklineProps {
  data: number[];
  /**
   * Required text alternative describing the trend (e.g.
   * "6-month spend trend, up 8%"). Rendered in a sr-only sibling so
   * screen readers get a single concise summary instead of the SVG.
   *
   * Required by §3.1 a11y rules — every Sparkline must carry an
   * AT-readable description.
   */
  srLabel: string;
  /** Width in px. Default 180. */
  w?: number;
  /** Height in px. Default 52. */
  h?: number;
  /** Stroke color for the line + area gradient base. Default uses --primary. */
  color?: string;
}

/**
 * Compact SVG line + area chart with an animated pulse dot at the
 * latest value. The pulse dot is suppressed in `workbench` intensity
 * (per §3.3 — no continuous animations on dense pages).
 */
export function Sparkline({
  data,
  srLabel,
  w = 180,
  h = 52,
  color = 'var(--color-primary)',
}: SparklineProps) {
  const gradientId = useId();
  const intensity = useAtelierIntensity();
  if (!data.length) {
    return <span className="sr-only">{srLabel}</span>;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 4;
  const toY = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2);
  const step = w / Math.max(data.length - 1, 1);

  const linePoints = data.map((v, i) => `${i * step},${toY(v)}`).join(' ');
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  const lastX = (data.length - 1) * step;
  const lastY = toY(data[data.length - 1] as number);
  const pulseDot = intensity !== 'workbench';

  return (
    <>
      <span className="sr-only">{srLabel}</span>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="overflow-visible"
        aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pulseDot ? (
          <circle cx={lastX} cy={lastY} r={4} fill={color} opacity={0.9}>
            <animate attributeName="r" values="4;6;4" dur="2.5s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.9;0.4;0.9"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </circle>
        ) : (
          <circle cx={lastX} cy={lastY} r={3} fill={color} opacity={0.9} />
        )}
      </svg>
    </>
  );
}
