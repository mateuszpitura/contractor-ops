import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Navigate } from 'react-router-dom';
import { useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { ClassificationAdvisoryBanner } from '../../classification/advisory-banner.js';
import { WorkbenchPageHeader } from '../../shared/workbench-page-header.js';
import { MarketCard } from './dashboard/market-card.js';
import { RefreshDashboardButton } from './dashboard/refresh-dashboard-button.js';
import {
  useClassificationDashboard,
  useClassificationDashboardGlobalHeader,
  useClassificationGlobalHeaderDisplay,
} from './hooks/use-classification-dashboard.js';

function ClassificationGlobalHeader() {
  const t = useTranslations('Classification.polish.dashboard');
  const { isLoading, data } = useClassificationDashboardGlobalHeader();
  const { lastScannedDisplay } = useClassificationGlobalHeaderDisplay(data?.lastScannedAt);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const { totalContractors, totalActiveEngagements } = data;

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      data-testid="classification-dashboard-global-header">
      <div className="flex flex-col gap-1 rounded-lg border bg-surface-1 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('totalContractorsLabel')}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{totalContractors}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border bg-surface-1 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('totalActiveEngagementsLabel')}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{totalActiveEngagements}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border bg-surface-1 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('lastScannedLabel')}
        </span>
        <span className="text-sm font-medium">{lastScannedDisplay}</span>
      </div>
    </div>
  );
}

export function ClassificationDashboardContainer() {
  const locale = useLocale();
  const t = useTranslations('Classification.polish.dashboard');
  const dashboard = useClassificationDashboard();

  if (!dashboard.classificationEnabled) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  return (
    <>
      <ClassificationAdvisoryBanner jurisdiction={dashboard.jurisdiction} />
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:py-12">
        <WorkbenchPageHeader title={t('pageH1')} description={t('pageSubline')} />

        <ClassificationGlobalHeader />

        <div className="flex justify-end">
          <RefreshDashboardButton />
        </div>

        <div className="flex flex-col gap-8">
          <MarketCard market="GB" />
          <MarketCard market="DE" />
        </div>
      </div>
    </>
  );
}

/** @deprecated Use ClassificationDashboard */
export { ClassificationDashboardContainer as ClassificationDashboard };
