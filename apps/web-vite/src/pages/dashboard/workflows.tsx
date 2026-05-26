/**
 * Workflows list — thin route shell.
 */

import { Suspense } from 'react';

import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkflowsListContainer } from '../../components/workflows/workflows-list-container.js';

export default function WorkflowsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowsListContainer />
    </Suspense>
  );
}
