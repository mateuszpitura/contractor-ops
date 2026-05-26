/**
 * Equipment list — thin route shell.
 */

import { Suspense } from 'react';

import { EquipmentListContainer } from '../../components/equipment/equipment-list-container.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

export default function EquipmentPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EquipmentListContainer />
    </Suspense>
  );
}
