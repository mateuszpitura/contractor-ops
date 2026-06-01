import {
  AtelierEmptyState,
  ComplianceGapsIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { OverrideComplianceItemButton } from '../../contractors/compliance/override-compliance-item-button.js';
import { AnimateIn } from '../../shared/animate-in.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../../shared/workbench-page-header.js';
import { AtRiskTable } from './at-risk-table/data-table.js';
import { BlockedPaymentsTable } from './blocked-payments-table/data-table.js';
import { ComplianceDashboardSkeleton } from './compliance-dashboard-skeleton.js';
import { ComplianceKpiCards } from './compliance-kpi-cards.js';
import type { ComplianceDashboardTab } from './hooks/use-compliance-dashboard.js';
import { useComplianceDashboard } from './hooks/use-compliance-dashboard.js';
import { UpcomingRenewalsTable } from './upcoming-renewals-table/data-table.js';

/**
 * Decisive container for the admin compliance dashboard (D-01..D-05). Owns the
 * active-tab state, permission-gates on `compliance:read`, and branches
 * loading → skeleton / error → role=alert / empty → AtelierEmptyState / else
 * compose KPI cards + the active tab table.
 */
export function ComplianceDashboardContainer() {
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
            />
          )}
          {tab === 'blocked-payments' && (
            <BlockedPaymentsTable
              rows={dash.blockedProps.rows}
              totalRows={dash.blockedProps.totalRows}
              isRefetching={dash.blockedProps.isRefetching}
            />
          )}
        </section>
      </AnimateIn>
    </div>
  );
}
