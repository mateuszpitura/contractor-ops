import { Suspense } from 'react';

import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { TimeTrackingContainer } from '../../components/time/time-tracking-container.js';

export default function TimePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <TimeTrackingContainer />
    </Suspense>
  );
}
