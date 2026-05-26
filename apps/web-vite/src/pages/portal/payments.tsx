import { Suspense } from 'react';

import { PortalPaymentsContainer } from '../../components/portal/portal-payments-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalPaymentsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalPaymentsContainer />
    </Suspense>
  );
}
