import { Suspense } from 'react';

import { ClassificationExpertHelpContainer } from '../../components/classification/classification-expert-help-container.js';
import { ClassificationGuardContainer } from '../../components/classification/classification-guard-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ClassificationExpertHelpPage() {
  return (
    <ClassificationGuardContainer>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ClassificationExpertHelpContainer />
      </Suspense>
    </ClassificationGuardContainer>
  );
}
