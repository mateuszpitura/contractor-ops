import { Suspense } from 'react';

import { ClassificationGuardContainer } from '../../../components/classification/classification-guard-container.js';
import { ContractorClassificationContainer } from '../../../components/contractors/contractor-classification-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function ContractorClassificationPage() {
  return (
    <ClassificationGuardContainer>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ContractorClassificationContainer />
      </Suspense>
    </ClassificationGuardContainer>
  );
}
