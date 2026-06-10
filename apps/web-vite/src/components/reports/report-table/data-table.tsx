import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef, Table } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { useReportTableState } from '../hooks/use-report-table-state.js';
import { DataTableColumnToggle } from './data-table-column-toggle.js';

interface ReportTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  totalCount: number;
  /** 1-based page index, matching the report hooks' URL state. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  sortBy: string;
  sortOrder: string;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  grandTotalLabel?: string;
  grandTotalValue?: string;
  /** Pre-pluralized entity label rendered in the chrome (e.g. "rows", "transactions"). */
  entityLabel?: string;
}

/**
 * Adapter wrapping the canonical workbench `DataTable` for reports. Translates
 * the report-friendly API (1-based `page`, separate `sortBy`/`sortOrder`,
 * `isError`/`onRetry`, grand-total footer) to the primitive's contract.
 */
export function ReportTable<TData>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  sortBy,
  sortOrder,
  onRowClick,
  isLoading,
  isFetching,
  isError,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  grandTotalLabel,
  grandTotalValue,
  entityLabel,
}: ReportTableProps<TData>) {
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  const { sorting, handleSortingChange, columnVisibility, setColumnVisibility } =
    useReportTableState<TData>({
      sortBy,
      sortOrder,
      onSortChange,
    });

  const handlePageSizeChange = useCallback(
    (size: number) => {
      onPageSizeChange?.(size);
    },
    [onPageSizeChange],
  );

  const renderColumnToggle = useCallback(
    (table: Table<TData>) => <DataTableColumnToggle table={table} />,
    [],
  );

  const resolvedEmptyTitle = emptyTitle ?? tCommon('noData');
  const showGrandTotal =
    !(isLoading || isError) && data.length > 0 && grandTotalLabel && grandTotalValue;

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border bg-card p-8 text-center"
        data-slot="report-table-error">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {tErr('retry')}
          </Button>
        ) : null}
      </div>
    );
  }

  // When loading, hide pagination by passing totalRows ≤ smallest page-size
  // option so the primitive's `shouldHideFooter` short-circuits the footer.
  // Matches the legacy ReportTable contract that suppressed pagination during
  // initial fetches.
  const effectiveTotalRows = isLoading ? 0 : totalCount;

  return (
    <div className="flex flex-col gap-2">
      <WorkbenchDataTable<TData>
        columns={columns}
        data={data}
        totalRows={effectiveTotalRows}
        pageIndex={Math.max(0, page - 1)}
        pageSize={pageSize}
        onPageChange={nextIndex => onPageChange(nextIndex + 1)}
        onPageSizeChange={handlePageSizeChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        isLoading={isLoading}
        // Skeleton branch must win over the refetch overlay — only mark
        // refetching when fetching without a full reload.
        isRefetching={isFetching && !isLoading}
        constrainHeight={false}
        entityLabel={entityLabel ?? tCommon('rows', { count: totalCount })}
        emptyIcon={emptyIcon}
        emptyTitle={resolvedEmptyTitle}
        emptyDescription={emptyDescription}
        noResultsTitle={resolvedEmptyTitle}
        noResultsDescription={emptyDescription}
        onRowClick={onRowClick}
        rightSlot={renderColumnToggle}
      />
      {showGrandTotal ? (
        <div className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-r from-muted/20 via-card to-muted/20 shadow-sm">
          <div
            aria-hidden
            className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          />
          <div className="flex items-baseline justify-between gap-6 px-6 py-5">
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden
                className="font-display text-[18px] font-medium leading-none text-primary/60">
                Σ
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {grandTotalLabel}
              </span>
            </div>
            <span className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {grandTotalValue}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
