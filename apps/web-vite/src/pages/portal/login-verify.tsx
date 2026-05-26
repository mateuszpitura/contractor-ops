import { Suspense } from 'react';

import { PortalLoginVerifyContainer } from '../../components/portal/portal-login-verify-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalVerifyPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalLoginVerifyContainer />
    </Suspense>
  );
}
