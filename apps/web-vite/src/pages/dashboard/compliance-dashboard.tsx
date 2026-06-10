/**
 * Admin compliance dashboard — route shell with inlined page content.
 */

import {
  AtelierEmptyState,
  ComplianceGapsIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { ShieldAlert } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AtRiskTable } from '../../components/compliance/dashboard/at-risk-table/data-table.js';
import { BlockedPaymentsTable } from '../../components/compliance/dashboard/blocked-payments-table/data-table.js';
import { ComplianceDashboardSkeleton } from '../../components/compliance/dashboard/compliance-dashboard-skeleton.js';
import { ComplianceKpiCards } from '../../components/compliance/dashboard/compliance-kpi-cards.js';
import type { ComplianceDashboardTab } from '../../components/compliance/dashboard/hooks/use-compliance-dashboard.js';
import { useComplianceDashboard } from '../../components/compliance/dashboard/hooks/use-compliance-dashboard.js';
import { UpcomingRenewalsTable } from '../../components/compliance/dashboard/upcoming-renewals-table/data-table.js';
import { OverrideComplianceItemButton } from '../../components/contractors/compliance/override-compliance-item-button.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

export function ComplianceDashboardPageContent() {
  const t = useTranslations('Compliance.dashboard');
  const locale = useLocale();
  const { can } = usePermissions();
  const [tab, setTab] = useState<ComplianceDashboardTab>('at-risk');
  const dash = useComplianceDashboard();

  if (!can('compliance', ['read'])) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  if (dash.isPending) {
    return <ComplianceDashboardSkeleton />;
  }

  if (dash.error) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
        <p role="alert" className="text-destructive">
          {t('errorLoading')}
        </p>
      </div>
    );
  }

  if (dash.isEmpty) {
    return (
      <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
        <AtelierEmptyState
          illustration={ComplianceGapsIllustration}
          heading={t('empty.heading')}
          body={t('empty.body')}
          renderAction={renderEmptyStateAction}
        />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col gap-6">
        <ComplianceKpiCards kpis={dash.kpis} activeTab={tab} onTabChange={setTab} />

        <section
          className={WORKBENCH_TABLE_SECTION_CLASS}
          aria-label={t(
            {
              'at-risk': 'atRisk.label',
              'upcoming-renewals': 'upcomingRenewals.label',
              'blocked-payments': 'blockedPayments.label',
            }[tab] ?? 'atRisk.label',
          )}>
          <SectionLabel icon={ShieldAlert}>
            {t(
              {
                'at-risk': 'atRisk.label',
                'upcoming-renewals': 'upcomingRenewals.label',
                'blocked-payments': 'blockedPayments.label',
              }[tab] ?? 'atRisk.label',
            )}
          </SectionLabel>
          {tab === 'at-risk' && (
            <AtRiskTable
              rows={dash.atRiskProps.rows}
              totalRows={dash.atRiskProps.totalRows}
              sectionClassName=""
              renderRowActions={row => (
                <OverrideComplianceItemButton
                  itemId={row.id}
                  severity={row.severity}
                  status={row.status}
                />
              )}
            />
          )}
          {tab === 'upcoming-renewals' && (
            <UpcomingRenewalsTable
              rows={dash.upcomingProps.rows}
              totalRows={dash.upcomingProps.totalRows}
              sectionClassName=""
            />
          )}
          {tab === 'blocked-payments' && (
            <BlockedPaymentsTable
              rows={dash.blockedProps.rows}
              totalRows={dash.blockedProps.totalRows}
              isRefetching={dash.blockedProps.isRefetching}
              sectionClassName=""
            />
          )}
        </section>
      </AnimateIn>
    </div>
  );
}

export default function ComplianceDashboardPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ComplianceDashboardPageContent />
    </Suspense>
  );
}
