import { Suspense } from 'react';

import { InvoiceIntakePageContainer } from '../../../components/invoices/invoice-intake-page-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function InvoiceIntakePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoiceIntakePageContainer />
    </Suspense>
  );
}
