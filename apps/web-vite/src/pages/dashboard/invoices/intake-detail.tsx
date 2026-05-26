import { Suspense } from 'react';

import { IntakeDetailContainer } from '../../../components/invoices/intake/intake-detail-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function InvoiceIntakeDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <IntakeDetailContainer />
    </Suspense>
  );
}
