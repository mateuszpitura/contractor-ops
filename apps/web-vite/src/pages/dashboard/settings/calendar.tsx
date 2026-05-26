import { Suspense } from 'react';

import { SettingsCalendarContainer } from '../../../components/settings/settings-calendar-container.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';

export default function CalendarSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <SettingsCalendarContainer />
    </Suspense>
  );
}
