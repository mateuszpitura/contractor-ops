import { AtelierEmptyState, TimeTrackingIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { RefreshCw } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { useReconciliationTable } from './hooks/use-reconciliation-table.js';
import { ReconciliationTableView } from './reconciliation-table.js';

function ReconciliationSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`skel-${i}`} className="flex items-center gap-4 rounded-lg border px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

function ReconciliationError({ onRetry }: { onRetry: () => void }) {
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {tProfile('error.retry')}
      </Button>
    </div>
  );
}

function ReconciliationEmpty() {
  const t = useTranslations('Time');
  return (
    <AtelierEmptyState
      illustration={TimeTrackingIllustration}
      heading={t('reconciliation.noDataHeading')}
      body={t('reconciliation.noDataBody')}
      renderAction={renderEmptyStateAction}
    />
  );
}

export function ReconciliationTable() {
  const table = useReconciliationTable();

  if (table.isLoading) return <ReconciliationSkeleton />;
  if (table.isError) return <ReconciliationError onRetry={table.onRetry} />;
  if (table.isEmpty) return <ReconciliationEmpty />;

  return (
    <ReconciliationTableView
      items={table.items}
      totalCount={table.totalCount}
      hasNextPage={table.hasNextPage}
      isFetchingNextPage={table.isFetchingNextPage}
      onLoadMore={table.onLoadMore}
    />
  );
}
