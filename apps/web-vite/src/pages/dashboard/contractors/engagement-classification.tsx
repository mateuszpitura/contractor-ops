import { Suspense } from 'react';

import { ClassificationGuardContainer } from '../../../components/classification/classification-guard-container.js';
import { EngagementClassificationContainer } from '../../../components/contractors/engagement-classification-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function EngagementClassificationPage() {
  return (
    <ClassificationGuardContainer>
      <Suspense fallback={<PageLoadingSpinner />}>
        <EngagementClassificationContainer />
      </Suspense>
    </ClassificationGuardContainer>
  );
}
