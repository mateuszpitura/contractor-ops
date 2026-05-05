'use client';

import type { AtelierIntensity } from '@contractor-ops/ui';
import { AtelierIntensityProvider } from '@contractor-ops/ui';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';

/**
 * Route → intensity mapping. Locked decisions per
 * docs/UI-ATELIER-WORKPLAN.md §8 #3:
 *
 *   atelier:    /, /reports — dashboards and insight-heavy screens
 *   workbench:  /contractors, /invoices, /approvals, /payments,
 *               /workflows, /contracts, /settings, /portal,
 *               /equipment, /time, /classification, /onboarding,
 *               /notifications — dense operational pages
 *
 * Default for unmatched routes is workbench, which biases toward
 * legibility on dense pages and avoids accidentally enabling expensive
 * effects (orbs, hero glow, per-card tilt) where they don't belong.
 */
const ATELIER_ROUTES: ReadonlyArray<RegExp> = [
  /^\/?$/, // dashboard root
  /^\/reports(\/|$)/,
];

function intensityFor(pathname: string): AtelierIntensity {
  // pathname comes from next-intl's usePathname() which strips the locale,
  // so "/contractors/abc" is what we get on /pl/contractors/abc.
  for (const route of ATELIER_ROUTES) {
    if (route.test(pathname)) return 'atelier';
  }
  return 'workbench';
}

/**
 * Mounts the right AtelierIntensityProvider tier for the current route
 * and mirrors the value to `<body data-intensity="...">` so CSS that
 * lives outside React (e.g. global keyframes, third-party widgets) can
 * still respond to the tier without prop-drilling.
 */
export function IntensityRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const intensity = intensityFor(pathname);

  useEffect(() => {
    const prev = document.body.dataset.intensity;
    document.body.dataset.intensity = intensity;
    return () => {
      // Restore previous value (or remove) on unmount/navigation
      if (prev === undefined) {
        delete document.body.dataset.intensity;
      } else {
        document.body.dataset.intensity = prev;
      }
    };
  }, [intensity]);

  return <AtelierIntensityProvider value={intensity}>{children}</AtelierIntensityProvider>;
}
