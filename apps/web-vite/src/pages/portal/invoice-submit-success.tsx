import { Suspense } from 'react';

import { PortalInvoiceSubmitSuccessContainer } from '../../components/portal/portal-invoice-submit-success-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalInvoiceSubmitSuccessPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalInvoiceSubmitSuccessContainer />
    </Suspense>
  );
}
