import { AtelierIntensityProvider } from '@contractor-ops/ui';
import type { ReactNode } from 'react';

import { intensityForPathname, useIntensityRouter } from './hooks/use-intensity-router.js';

export { intensityForPathname };

export function IntensityRouter({ children }: { children: ReactNode }) {
  const intensity = useIntensityRouter();

  return (
    <AtelierIntensityProvider value={intensity}>
      <div data-intensity={intensity} className="contents">
        {children}
      </div>
    </AtelierIntensityProvider>
  );
}
