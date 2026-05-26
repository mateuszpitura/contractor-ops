import { Suspense } from 'react';

import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkflowTemplateNewContainer } from '../../../components/workflows/workflow-template-new-container.js';

export default function WorkflowTemplateNewPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowTemplateNewContainer />
    </Suspense>
  );
}
