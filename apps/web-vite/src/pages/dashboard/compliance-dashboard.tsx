import { Suspense } from 'react';

import { ComplianceDashboardContainer } from '../../components/compliance/dashboard/compliance-dashboard-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ComplianceDashboardPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ComplianceDashboardContainer />
    </Suspense>
  );
}
