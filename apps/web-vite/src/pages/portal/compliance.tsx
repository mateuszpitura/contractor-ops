import { Suspense } from 'react';

import { PortalComplianceContainer } from '../../components/portal/compliance/portal-compliance-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalCompliancePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalComplianceContainer />
    </Suspense>
  );
}
