import { CheckCircle, Clock, FileText, Users, Wallet } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { UsageKpiCard } from '../billing/usage-kpi-card.js';
import { AnimateIn } from '../shared/animate-in.js';
import { ActivityFeed } from './activity-feed.js';
import { ApprovalQueueWidget } from './approval-queue-widget.js';
import { DashboardGreeting } from './dashboard-greeting.js';
import { DashboardSkeleton } from './dashboard-skeleton.js';
import { DeadlinesWidget } from './deadlines-widget.js';
import { useDashboardHome } from './hooks/use-dashboard-home.js';
import { SpendChart } from './spend-chart.js';
import { TaxObligationsWidget } from './tax-obligations-widget.js';

export function DashboardHomeContainer() {
  const t = useTranslations('Dashboard');
  const { isPending, error, kpis } = useDashboardHome();

  if (isPending) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <main aria-labelledby="dashboard-heading">
        <p role="alert" className="text-destructive">
          {t('errorLoading')}: {String(error)}
        </p>
      </main>
    );
  }

  return (
    <main aria-labelledby="dashboard-heading" className="flex flex-col gap-8">
      <AnimateIn delay={0}>
        <DashboardGreeting />
      </AnimateIn>

      {kpis ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <UsageKpiCard
            icon={<Users className="h-4 w-4" />}
            label={t('kpi.activeContractors')}
            value={kpis.activeContractors.value}
          />
          <UsageKpiCard
            icon={<CheckCircle className="h-4 w-4" />}
            label={t('kpi.pendingApprovals')}
            value={kpis.pendingApprovals.value}
          />
          <UsageKpiCard
            icon={<Wallet className="h-4 w-4" />}
            label={t('kpi.readyToPay')}
            value={(kpis.readyToPayTotal.valueMinor / 100).toLocaleString(undefined, {
              style: 'currency',
              currency: 'EUR',
            })}
          />
          <UsageKpiCard
            icon={<FileText className="h-4 w-4" />}
            label={t('kpi.expiringContracts')}
            value={kpis.expiringContracts.value}
          />
          <UsageKpiCard
            icon={<Clock className="h-4 w-4" />}
            label={t('kpi.openTasks')}
            value={kpis.openTasks.value}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      )}

      <AnimateIn delay={2}>
        <SpendChart />
      </AnimateIn>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AnimateIn delay={3}>
          <ApprovalQueueWidget />
        </AnimateIn>
        <AnimateIn delay={4}>
          <DeadlinesWidget />
        </AnimateIn>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AnimateIn delay={5}>
          <TaxObligationsWidget />
        </AnimateIn>
        <AnimateIn delay={5}>
          <ActivityFeed />
        </AnimateIn>
      </div>
    </main>
  );
}
