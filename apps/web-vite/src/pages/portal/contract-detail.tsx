import { Suspense } from 'react';

import { PortalContractDetailContainer } from '../../components/portal/portal-contract-detail-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalContractDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalContractDetailContainer />
    </Suspense>
  );
}
