import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import { HrDashboardHeader } from '../../components/hr-dashboard/hr-dashboard-header.js';
import { HrDocExpirySection } from '../../components/hr-dashboard/hr-doc-expiry-section.js';
import { HrHeadcountSection } from '../../components/hr-dashboard/hr-headcount-section.js';
import { HrNationalisationSection } from '../../components/hr-dashboard/hr-nationalisation-section.js';
import { HrProbationSection } from '../../components/hr-dashboard/hr-probation-section.js';
import { HrUtilizationSection } from '../../components/hr-dashboard/hr-utilization-section.js';
import { useFlag } from '../../components/layout/feature-flag-context.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { isHrDashboardRole } from '../../lib/hr-roles.js';

function HrDashboardPageContent() {
  const t = useTranslations('HrDashboard');
  const locale = useLocale();
  const { role, isLoading } = usePermissions();
  const hrDashboardEnabled = useFlag('module.hr-dashboard');

  // Wait for the active-member role before deciding — otherwise the gate would
  // flash the redirect while the membership query is still in flight.
  if (isLoading) return <PageLoadingSpinner />;

  // Defense-in-depth over the server gate: a non-HR member (or a disabled module)
  // never reaches the surface. The hrDashboard.* procedures independently return
  // FORBIDDEN / METHOD_NOT_FOUND — the UI gate is UX, not the security boundary.
  // The four HR roles hold the server `employee:read` grant; they are not part of
  // the client `MemberRole` union, so we match the raw role directly (see
  // lib/hr-roles.ts).
  if (!(hrDashboardEnabled && isHrDashboardRole(role))) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  return (
    <div className="space-y-card-gap">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} description={t('subtitle')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <HrDashboardHeader />
      </AnimateIn>

      <AnimateIn delay={2}>
        <HrHeadcountSection />
      </AnimateIn>

      <AnimateIn delay={3}>
        <HrUtilizationSection />
      </AnimateIn>

      <AnimateIn delay={4}>
        <HrDocExpirySection />
      </AnimateIn>

      <AnimateIn delay={5}>
        <HrProbationSection />
      </AnimateIn>

      <AnimateIn delay={5}>
        <HrNationalisationSection />
      </AnimateIn>
    </div>
  );
}

export default function HrDashboardPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <HrDashboardPageContent />
    </Suspense>
  );
}
