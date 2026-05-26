import { Suspense } from 'react';

import { AdminClassificationEngineContainer } from '../../components/admin/admin-classification-engine-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function ClassificationEngineFlagPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <AdminClassificationEngineContainer />
    </Suspense>
  );
}
