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
    <div
      aria-hidden="true"
      className="atelier-fade-in pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Drifting gradient orbs — dark mode toned down to stay sub-threshold
          (chromatic atmosphere, not visible blobs). Light mode values are
          calibrated for a bright base that drowns out gradient shapes. */}
      <div className="absolute -start-[10%] -top-[10%] h-[800px] w-[800px] rounded-full opacity-60 dark:opacity-25" />
      <div className="absolute -end-[5%] top-[10%] h-[650px] w-[650px] rounded-full opacity-50 dark:opacity-15" />
      <div className="absolute bottom-[-5%] start-[35%] h-[550px] w-[550px] rounded-full opacity-40 dark:opacity-20" />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.4]" />
    </div>
  );
}
