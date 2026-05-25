import { Suspense } from 'react';

import { AdminBoeRateContainer } from '../../components/admin/boe-rate/admin-boe-rate-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function AdminBoeRatePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <AdminBoeRateContainer />
    </Suspense>
  );
}
