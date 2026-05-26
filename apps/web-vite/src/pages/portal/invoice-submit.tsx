import { Suspense } from 'react';

import { PortalInvoiceSubmitContainer } from '../../components/portal/portal-invoice-submit-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalInvoiceSubmitPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalInvoiceSubmitContainer />
    </Suspense>
  );
}
