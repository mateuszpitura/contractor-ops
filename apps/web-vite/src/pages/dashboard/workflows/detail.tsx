import { Suspense } from 'react';

import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkflowRunDetailContainer } from '../../../components/workflows/workflow-run-detail-container.js';

export default function WorkflowRunDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowRunDetailContainer />
    </Suspense>
  );
}
