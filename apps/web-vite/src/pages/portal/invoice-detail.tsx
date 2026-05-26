import { Suspense } from 'react';

import { PortalInvoiceDetailContainer } from '../../components/portal/portal-invoice-detail-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalInvoiceDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalInvoiceDetailContainer />
    </Suspense>
  );
}
