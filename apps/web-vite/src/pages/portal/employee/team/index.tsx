/**
 * Manager team home — thin route shell composing the wired overview + pending
 * leave approvals. A non-manager sees a forbidden state (server-enforced), not a
 * crash.
 */

import { Suspense } from 'react';

import { ManagerApprovals } from '../../../../components/portal/employee/team/manager-approvals.js';
import { ManagerOverview } from '../../../../components/portal/employee/team/manager-overview.js';
import { AnimateIn } from '../../../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';

export default function ManagerTeamPage() {
  const t = useTranslations('Portal.employee.team');
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <Suspense fallback={<PageLoadingSpinner />}>
        <div className="space-y-6">
          <AnimateIn>
            <ManagerOverview />
          </AnimateIn>
          <AnimateIn delay={1}>
            <ManagerApprovals />
          </AnimateIn>
        </div>
      </Suspense>
    </div>
  );
}
