/**
 * Admin personnel-document classify-review queue — thin page shell.
 *
 * Reached only when `module.workforce-employees` is enabled; the flag gate and
 * all data access live in the wired view. Auth gating lives on the shell parent
 * in router.tsx. Surfaces the PENDING_REVIEW personnel documents an admin must
 * classify into section A/B/C/D (AKTA-04 admin classify-step).
 */

import { Suspense } from 'react';

import { PersonnelClassifyQueueView } from '../../../components/employees/personnel-file/personnel-classify-queue/data-table.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function PersonnelClassifyQueuePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PersonnelClassifyQueueView />
    </Suspense>
  );
}
