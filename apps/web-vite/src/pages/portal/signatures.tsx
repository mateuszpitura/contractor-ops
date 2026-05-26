import { Suspense } from 'react';

import { PortalSignaturesContainer } from '../../components/portal/portal-pending-signatures-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalSignaturesRoutePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalSignaturesContainer />
    </Suspense>
  );
}
