import { Suspense } from 'react';

import { ClassificationGuard } from '../../components/classification/classification-guard.js';
import { ClassificationDashboardContainer } from '../../components/contractors/classification/classification-dashboard.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ClassificationPage() {
  return (
    <ClassificationGuard>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ClassificationDashboardContainer />
      </Suspense>
    </ClassificationGuard>
  );
}
