import { Suspense } from 'react';

import { PortalSettingsContainer } from '../../components/portal/portal-settings-page.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalSettingsContainer />
    </Suspense>
  );
}
