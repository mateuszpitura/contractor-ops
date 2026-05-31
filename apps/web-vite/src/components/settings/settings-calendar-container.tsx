import { useTranslations } from '../../i18n/useTranslations.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { MyCalendarSectionContainer } from './my-calendar-section-container.js';

// Decision: composition — pairs the localized WorkbenchPageHeader with
// MyCalendarSectionContainer so the calendar settings route stays a thin Suspense shell.
export function SettingsCalendarContainer() {
  const t = useTranslations('CalendarSettings');

  return (
    <div className="space-y-8">
      <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      <MyCalendarSectionContainer />
    </div>
  );
}
