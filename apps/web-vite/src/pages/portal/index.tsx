import { Suspense } from 'react';

import { PortalIndexContainer } from '../../components/portal/portal-index-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalIndexPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalIndexContainer />
    </Suspense>
  );
}
