import { Suspense } from 'react';

import { ClassificationGuard } from '../../../components/classification/classification-guard.js';
import { EngagementClassificationContainer } from '../../../components/contractors/engagement-classification.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function EngagementClassificationPage() {
  return (
    <ClassificationGuard>
      <Suspense fallback={<PageLoadingSpinner />}>
        <EngagementClassificationContainer />
      </Suspense>
    </ClassificationGuard>
  );
}
