import { AtelierPageHeader } from '@contractor-ops/ui';

import { useTranslations } from '../../i18n/useTranslations.js';
import { MyCalendarSectionContainer } from './my-calendar-section-container.js';

// Decision: composition — pairs the localized AtelierPageHeader with
// MyCalendarSectionContainer so the calendar settings route stays a thin Suspense shell.
export function SettingsCalendarContainer() {
  const t = useTranslations('CalendarSettings');

  return (
    <div className="space-y-8">
      <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      <MyCalendarSectionContainer />
    </div>
  );
}
