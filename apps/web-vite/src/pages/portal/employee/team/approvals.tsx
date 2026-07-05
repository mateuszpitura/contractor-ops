/**
 * Manager approvals — thin route shell. Data + states live in the wired section.
 */

import { Suspense } from 'react';

import { ManagerApprovals } from '../../../../components/portal/employee/team/manager-approvals.js';
import { PageLoadingSpinner } from '../../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';

export default function ManagerApprovalsPage() {
  const t = useTranslations('Portal.employee.team.approvals');
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </header>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ManagerApprovals />
      </Suspense>
    </div>
  );
}
