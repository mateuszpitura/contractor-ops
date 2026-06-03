import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useSaudizationConfig } from './hooks/use-saudization-config.js';
import { useSaudizationDashboard } from './hooks/use-saudization-dashboard.js';
import { SaudizationConfigDialog } from './saudization-config-dialog.js';
import { SaudizationDashboard } from './saudization-dashboard.js';

type ConfigEntryProps = Pick<
  React.ComponentProps<typeof SaudizationDashboard>,
  'onSaveBand' | 'isSavingBand' | 'onSaveHeadcount' | 'isSavingHeadcount'
>;

/**
 * Owns the loading / error / empty / success variant decision for the Saudization
 * dashboard (D-17 mandatory states). The two hooks are the only tRPC boundary; this
 * container picks which view renders. "Configured" = a band, segment, or headcount
 * has been recorded — before that the empty state invites the first manual entry.
 */
export function SaudizationDashboardContainer() {
  const dashboardQuery = useSaudizationDashboard();
  const config = useSaudizationConfig();

  if (dashboardQuery.isLoading) {
    return <SaudizationDashboardSkeleton />;
  }

  if (dashboardQuery.isError || dashboardQuery.data === null) {
    return <SaudizationDashboardError onRetry={dashboardQuery.onRetry} />;
  }

  const dashboard = dashboardQuery.data;
  const configEntry: ConfigEntryProps = {
    onSaveBand: config.saveBand,
    isSavingBand: config.isSavingBand,
    onSaveHeadcount: config.saveHeadcount,
    isSavingHeadcount: config.isSavingHeadcount,
  };

  const isConfigured =
    dashboard.band !== null ||
    dashboard.totalHeadcount !== null ||
    dashboard.industrySegment !== null;

  if (!isConfigured) {
    return <SaudizationDashboardEmpty {...configEntry} />;
  }

  return (
    <SaudizationDashboard
      dashboard={dashboard}
      thresholdsCustom={config.config?.thresholdsCustom ?? false}
      permittedActivityCatalogueCustom={config.config?.permittedActivityCatalogueCustom ?? false}
      {...configEntry}
      onApplyNitaqatOverride={config.applyNitaqatOverride}
      isApplyingNitaqatOverride={config.isApplyingNitaqatOverride}
      onApplyActivityOverride={config.applyActivityOverride}
      isApplyingActivityOverride={config.isApplyingActivityOverride}
    />
  );
}

function SaudizationDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-64" />
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="size-40 rounded-full" />
        </CardContent>
      </Card>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}

function SaudizationDashboardError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Saudization.error');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
          {t('loadHeading')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('loadBody')}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('retry')}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Empty state (UI-SPEC "Saudization not configured"). Reuses the config dialog as the
 * first-entry path — owns only the open/closed UI state; the mutation host is the hook.
 */
function SaudizationDashboardEmpty(configEntry: ConfigEntryProps) {
  const t = useTranslations('Saudization.empty');
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <BarChart3 aria-hidden="true" className="size-7 text-muted-foreground" />
        <p className="text-lg font-semibold">{t('heading')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t('body')}</p>
        <Button onClick={() => setOpen(true)}>{t('cta')}</Button>
      </CardContent>
      <SaudizationConfigDialog
        open={open}
        onOpenChange={setOpen}
        initialBand={null}
        initialSegment={null}
        initialTotalHeadcount={null}
        initialSaudiHeadcount={null}
        {...configEntry}
      />
    </Card>
  );
}
