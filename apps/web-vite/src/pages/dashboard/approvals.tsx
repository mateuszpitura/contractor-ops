/**
 * Approvals queue — thin route shell.
 */

import { Suspense } from 'react';

import { ApprovalQueueContainer } from '../../components/approvals/approval-queue-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ApprovalQueueContainer />
    </Suspense>
  );
}
