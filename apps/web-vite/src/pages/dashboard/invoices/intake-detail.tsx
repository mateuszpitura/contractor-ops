/**
 * Invoice intake detail — thin route shell.
 */

import { Suspense } from 'react';

import { IntakeDetail } from '../../../components/invoices/intake/intake-detail.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function InvoiceIntakeDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <IntakeDetail />
    </Suspense>
  );
}
