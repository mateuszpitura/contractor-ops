/**
 * Employee self-service home — thin route shell inside the authenticated portal.
 * All data + variant states live in the wired `EmployeeDashboard`.
 */

import { Suspense } from 'react';

import { EmployeeDashboard } from '../../../components/portal/employee/employee-dashboard.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export default function EmployeePortalPage() {
  const t = useTranslations('Portal.employee.dashboard');
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <Suspense fallback={<PageLoadingSpinner />}>
        <EmployeeDashboard />
      </Suspense>
    </div>
  );
}
