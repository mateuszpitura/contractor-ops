/**
 * Dashboard index — thin route shell.
 */

import { Suspense } from 'react';

import { DashboardHomeContainer } from '../../components/dashboard/dashboard-home-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <DashboardHomeContainer />
    </Suspense>
  );
}
