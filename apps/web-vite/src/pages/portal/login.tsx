import { Suspense } from 'react';

import { PortalLoginContainer } from '../../components/portal/portal-login-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalLoginContainer />
    </Suspense>
  );
}
