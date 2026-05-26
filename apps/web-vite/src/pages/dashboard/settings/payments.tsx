import { Suspense } from 'react';

import { SettingsPaymentsContainer } from '../../../components/settings/settings-payments-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsPaymentsContainer />
    </Suspense>
  );
}
