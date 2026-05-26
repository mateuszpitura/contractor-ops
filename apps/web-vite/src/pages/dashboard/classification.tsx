import { Suspense } from 'react';

import { ClassificationGuardContainer } from '../../components/classification/classification-guard-container.js';
import { ClassificationDashboardContainer } from '../../components/contractors/classification/classification-dashboard-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ClassificationPage() {
  return (
    <ClassificationGuardContainer>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ClassificationDashboardContainer />
      </Suspense>
    </ClassificationGuardContainer>
  );
}
