import { Suspense } from 'react';

import { ClassificationGuard } from '../../../components/classification/classification-guard.js';
import { ContractorClassification } from '../../../components/contractors/contractor-classification.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function ContractorClassificationPage() {
  return (
    <ClassificationGuard>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ContractorClassification />
      </Suspense>
    </ClassificationGuard>
  );
}
