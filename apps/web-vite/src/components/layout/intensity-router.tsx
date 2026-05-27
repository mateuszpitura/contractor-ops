import { AtelierIntensityProvider } from '@contractor-ops/ui';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { intensityForPathname, useIntensityRouter } from './hooks/use-intensity-router.js';

export { intensityForPathname };

export function IntensityRouter({ children }: { children: ReactNode }) {
  const intensity = useIntensityRouter();

  // Mirror intensity onto <body data-intensity="..."> so CSS selectors like
  // `body[data-intensity="atelier"].dark .atelier-main-surface::before` can
  // match. The `.dark` class lives on <html> (theme-init.js + ThemeProvider),
  // so a div-level data-attribute alone never triggers the dark-mode gradient.
  useEffect(() => {
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

  return (
    <AtelierIntensityProvider value={intensity}>
      <div data-intensity={intensity} className="contents">
        {children}
      </div>
    </AtelierIntensityProvider>
  );
}
