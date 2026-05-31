import { Suspense } from 'react';

import { PortalUploadReplacementContainer } from '../../components/portal/compliance/portal-upload-replacement-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalComplianceUploadReplacementPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalUploadReplacementContainer />
    </Suspense>
  );
}
