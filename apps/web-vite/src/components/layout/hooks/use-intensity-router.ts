import type { AtelierIntensity } from '@contractor-ops/ui';
import { useEffect } from 'react';

import { usePathname } from '../../../i18n/navigation.js';

/*
 * Atelier routes = dashboard root + reports tree. Anchoring on `^` is
 * mandatory — a bare `\/?$` matches every URL (every string ends with or
 * without a slash), which would force every workbench route into atelier
 * intensity and break the document-scroll vs viewport-lock split that
 * `body[data-intensity="workbench"]` selectors depend on (globals.css
 * workbench scroll model).
 */
const ATELIER_ROUTES: readonly RegExp[] = [/^\/?$/, /^\/reports(\/|$)/];

export function intensityForPathname(pathname: string): AtelierIntensity {
  for (const route of ATELIER_ROUTES) {
    if (route.test(pathname)) return 'atelier';
  }
  return 'workbench';
}

export function useIntensityRouter(): AtelierIntensity {
  const pathname = usePathname();
  const intensity = intensityForPathname(pathname);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.dataset.intensity;
    document.body.dataset.intensity = intensity;
    return () => {
      if (prev === undefined) {
        delete document.body.dataset.intensity;
      } else {
        document.body.dataset.intensity = prev;
      }
    };
  }, [intensity]);

  return intensity;
}
