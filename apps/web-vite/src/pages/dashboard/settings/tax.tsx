import { Suspense } from 'react';

import { SettingsTaxContainer } from '../../../components/settings/settings-tax-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function TaxSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsTaxContainer />
    </Suspense>
  );
}
