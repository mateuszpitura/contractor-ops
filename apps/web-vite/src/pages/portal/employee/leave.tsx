/**
 * Employee leave — thin route shell. Data + states live in the wired section.
 */

import { Suspense } from 'react';

import { EmployeeLeaveSection } from '../../../components/portal/employee/employee-leave-section.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export default function EmployeeLeavePage() {
  const t = useTranslations('Portal.employee.leave');
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </header>
      <Suspense fallback={<PageLoadingSpinner />}>
        <EmployeeLeaveSection />
      </Suspense>
    </div>
  );
}
