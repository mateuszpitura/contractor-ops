'use client';

import { useAtelierIntensity } from './intensity-provider.js';

/**
 * Decorative ambient background — three drifting gradient orbs + grain
 * texture + dot grid. Renders nothing in `workbench` intensity (per
 * §3.3 perf rules: orbs banned on dense operational pages).
 *
 * Always pointer-events: none and absolute-positioned. Consumers wrap
 * their page content in a relative container and place this as the
 * first child.
 */
export function AtelierBackground() {
  const intensity = useAtelierIntensity();
  if (intensity === 'workbench') return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Drifting gradient orbs */}
      <div
        className="absolute -start-[10%] -top-[10%] h-[800px] w-[800px] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)',
          animation: 'atelier-drift-1 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -end-[5%] top-[10%] h-[650px] w-[650px] rounded-full opacity-50"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in oklch, var(--accent-warm) 16%, transparent), transparent 70%)',
          animation: 'atelier-drift-2 28s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-5%] start-[35%] h-[550px] w-[550px] rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in oklch, var(--info) 14%, transparent), transparent 70%)',
          animation: 'atelier-drift-3 32s ease-in-out infinite',
        }}
      />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklch, var(--foreground) 7%, transparent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  );
}
