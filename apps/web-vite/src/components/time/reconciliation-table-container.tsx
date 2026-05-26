import { AtelierEmptyState, QueryErrorPanel, TimeTrackingIllustration } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';

import { useTranslations } from '../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { useReconciliationTable } from './hooks/use-reconciliation-table.js';
import { ReconciliationTableView } from './reconciliation-table.js';

function ReconciliationSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead className="text-end">
              <Skeleton className="ms-auto h-4 w-24" />
            </TableHead>
            <TableHead className="text-end">
              <Skeleton className="ms-auto h-4 w-24" />
            </TableHead>
            <TableHead className="text-end">
              <Skeleton className="ms-auto h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <TableRow key={`reconciliation-skel-${i}`}>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-end">
                <Skeleton className="ms-auto h-4 w-12" />
              </TableCell>
              <TableCell className="text-end">
                <Skeleton className="ms-auto h-4 w-20" />
              </TableCell>
              <TableCell className="text-end">
                <Skeleton className="ms-auto h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="size-4 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');

  if (table.isLoading) return <ReconciliationSkeleton />;
  if (table.isError)
    return (
      <QueryErrorPanel
        message={tCommon('networkError')}
        retryLabel={tProfile('error.retry')}
        onRetry={table.onRetry}
      />
    );
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
