/**
 * Contracts list — thin route shell.
 */

import { Suspense } from 'react';

import { ContractsListContainer } from '../../components/contracts/contracts-list-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ContractsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractsListContainer />
    </Suspense>
  );
}
