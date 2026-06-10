/**
 * Contractor detail — thin route shell.
 */

import { Suspense } from 'react';

import { ContractorDetailContainer } from '../../components/contractors/contractor-detail.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ContractorDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractorDetailContainer />
    </Suspense>
  );
}
