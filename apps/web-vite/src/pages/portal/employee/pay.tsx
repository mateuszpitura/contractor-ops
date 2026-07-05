/**
 * Employee pay — thin route shell. The pay-stub availability + empty state live
 * in the wired section.
 */

import { Suspense } from 'react';

import { EmployeePaySection } from '../../../components/portal/employee/employee-pay-section.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export default function EmployeePayPage() {
  const t = useTranslations('Portal.employee.pay');
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <Suspense fallback={<PageLoadingSpinner />}>
        <EmployeePaySection />
      </Suspense>
    </div>
  );
}
