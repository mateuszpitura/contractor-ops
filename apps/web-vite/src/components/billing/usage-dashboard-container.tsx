import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { RefreshCw } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import {
  deriveUsageDashboardTier,
  parseUsageDashboard,
  useUsageDashboard,
} from './hooks/use-billing.js';
import { UsageDashboard } from './usage-dashboard.js';

export function UsageDashboardContainer() {
  const t = useTranslations('Billing.usage');
  const dashboard = useUsageDashboard();

  if (dashboard.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`usage-${i}`} className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">{t('errorLoading')}</p>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="outline" size="sm" onClick={() => dashboard.refetch()}>
          <RefreshCw size={14} aria-hidden="true" />
          {t('retry')}
        </Button>
      </div>
    );
  }

  const parsed = dashboard.data ? parseUsageDashboard(dashboard.data) : null;
  if (!parsed) return null;

  const currentTier = parsed.subscription ? deriveUsageDashboardTier(parsed.subscription) : null;

  return (
    <UsageDashboard
      isLoading={false}
      isError={false}
      refetch={dashboard.refetch}
      parsed={parsed}
      currentTier={currentTier}
    />
  );
}
