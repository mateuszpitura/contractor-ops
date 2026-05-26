/**
 * Contractors list — thin route shell.
 */

import { Suspense } from 'react';

import { ContractorListContainer } from '../../components/contractors/contractor-list-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ContractorsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractorListContainer />
    </Suspense>
  );
}
