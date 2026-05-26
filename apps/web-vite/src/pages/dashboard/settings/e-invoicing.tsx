import { Suspense } from 'react';

import { SettingsEInvoicingContainer } from '../../../components/settings/settings-e-invoicing-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function EInvoicingSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsEInvoicingContainer />
    </Suspense>
  );
}
