import { Suspense } from 'react';

import { SettingsEInvoicingLogContainer } from '../../../components/settings/settings-e-invoicing-log-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function EInvoicingLogPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsEInvoicingLogContainer />
    </Suspense>
  );
}
