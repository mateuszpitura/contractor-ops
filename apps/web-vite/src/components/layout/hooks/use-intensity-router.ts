import type { AtelierIntensity } from '@contractor-ops/ui';
import { useEffect } from 'react';

import { usePathname } from '../../../i18n/navigation.js';

const ATELIER_ROUTES: ReadonlyArray<RegExp> = [/\/?$/, /^\/reports(\/|$)/];

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
