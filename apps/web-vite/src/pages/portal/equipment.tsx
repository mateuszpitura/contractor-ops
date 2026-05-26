import { Suspense } from 'react';

import { PortalEquipmentContainer } from '../../components/portal/portal-equipment-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function PortalEquipmentPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalEquipmentContainer />
    </Suspense>
  );
}
