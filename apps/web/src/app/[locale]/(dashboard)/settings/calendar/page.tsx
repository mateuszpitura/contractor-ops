'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import { useTranslations } from 'next-intl';
import { MyCalendarSection } from '@/components/settings/my-calendar-section';

export default function CalendarSettingsPage() {
  const t = useTranslations('CalendarSettings');

  return (
    <div className="space-y-8">
      <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      <MyCalendarSection />
    </div>
  );
}
