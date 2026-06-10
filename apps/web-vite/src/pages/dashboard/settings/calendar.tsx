import { Suspense } from 'react';

import { MyCalendarSection } from '../../../components/settings/my-calendar-section.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function CalendarSettingsContent() {
  const t = useTranslations('CalendarSettings');

  return (
    <div className="space-y-8">
      <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      <MyCalendarSection />
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <CalendarSettingsContent />
    </Suspense>
  );
}
