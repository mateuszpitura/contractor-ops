import { AtelierPageHeader } from '@contractor-ops/ui';

import { useTranslations } from '../../i18n/useTranslations.js';
import { MyCalendarSectionContainer } from './my-calendar-section-container.js';

/**
 * Decisive: page-level composition — pairs the localized
 * `AtelierPageHeader` with the calendar provider section container so the
 * calendar settings route page stays a thin Suspense shell.
 */
export function SettingsCalendarContainer() {
  const t = useTranslations('CalendarSettings');

  return (
    <div className="space-y-8">
      <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      <MyCalendarSectionContainer />
    </div>
  );
}
