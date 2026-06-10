import { Suspense } from 'react';

import { InvoiceIntakePage as InvoiceIntakePageContent } from '../../../components/invoices/invoice-intake-page.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function InvoiceIntakePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoiceIntakePageContent />
    </Suspense>
  );
}
