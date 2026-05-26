/**
 * Invoices list — thin route shell.
 */

import { Suspense } from 'react';

import { InvoicesListContainer } from '../../components/invoices/invoices-list-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoicesListContainer />
    </Suspense>
  );
}
