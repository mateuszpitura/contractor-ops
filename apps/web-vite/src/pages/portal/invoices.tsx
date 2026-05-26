import { Suspense } from 'react';

import { PortalInvoicesContainer } from '../../components/portal/portal-invoices-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalInvoicesPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalInvoicesContainer />
    </Suspense>
  );
}
