/**
 * Reports dashboard — thin route shell.
 */

import { Suspense } from 'react';

import { ReportsContainer } from '../../components/reports/reports-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ReportsContainer />
    </Suspense>
  );
}
