import { Suspense } from 'react';

import { PortalTimeContainer } from '../../components/portal/portal-time-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalTimePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalTimeContainer />
    </Suspense>
  );
}
