import { Suspense } from 'react';

import { PortalDocumentsContainer } from '../../components/portal/portal-documents-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalDocumentsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalDocumentsContainer />
    </Suspense>
  );
}
