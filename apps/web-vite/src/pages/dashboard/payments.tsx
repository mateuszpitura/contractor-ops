/**
 * Payments list — thin route shell.
 */

import { Suspense } from 'react';

import { PaymentsContainer } from '../../components/payments/payments-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PaymentsContainer />
    </Suspense>
  );
}
