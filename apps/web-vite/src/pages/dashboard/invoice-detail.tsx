import { Suspense } from 'react';

import { InvoiceDetailContainer } from '../../components/invoices/invoice-detail-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoiceDetailContainer />
    </Suspense>
  );
}
