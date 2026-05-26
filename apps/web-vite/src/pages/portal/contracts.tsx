import { Suspense } from 'react';

import { PortalContractsContainer } from '../../components/portal/portal-contracts-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalContractsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalContractsContainer />
    </Suspense>
  );
}
