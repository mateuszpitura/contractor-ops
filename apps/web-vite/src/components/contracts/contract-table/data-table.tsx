import { ContractsIllustration, DataTable } from '@contractor-ops/ui';
import type { ColumnDef, SortingState, Table, VisibilityState } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import type { ContractListTableProps } from '../hooks/use-contract-list.js';
import type { ContractRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';
import { DataTableColumnToggle } from './data-table-column-toggle.js';

const STORAGE_KEY = 'contract-table-columns';

interface ContractDataTableProps extends ContractListTableProps {
  onRowClick: (contract: ContractRow) => void;
  onNewContract: () => void;
  onImport?: () => void;
  parentLoading?: boolean;
  toolbar: ReactNode;
}

export function ContractDataTable({
  data,
  totalRows,
  filters,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  clearFilters,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  bulkActions,
  onRowClick,
  onNewContract,
  parentLoading,
  toolbar,
}: ContractDataTableProps) {
  const t = useTranslations('Contracts');

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedRows, setSelectedRows] = useState<ContractRow[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setColumnVisibility(JSON.parse(stored) as VisibilityState);
      }
      // safe-swallow: best-effort column-visibility hydration; corrupt/blocked storage falls back to defaults
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const isHydrated = useRef(false);
  useEffect(() => {
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
      // safe-swallow: best-effort column-visibility persistence; blocked/full storage is non-fatal
    } catch {
      // Ignore localStorage errors
    }
  }, [columnVisibility]);

  const columns: ColumnDef<ContractRow>[] = useMemo(() => getColumns(t, formatDate), [t]);

  const sorting = useMemo<SortingState>(
    () => [{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }],
    [filters.sortBy, filters.sortOrder],
  );

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (first) {
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      } else {
        onSortChange('endDate', 'asc');
      }
    },
    [sorting, onSortChange],
  );

  const renderColumnToggle = useCallback(
    (table: Table<ContractRow>) => <DataTableColumnToggle table={table} />,
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      totalRows={totalRows}
      pageIndex={Math.max(0, filters.page - 1)}
      pageSize={filters.pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={handleSortingChange}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      isLoading={isLoading}
      isRefetching={isRefetching}
      forceLoading={parentLoading}
      fill
      entityLabel={t('entityLabel', { count: totalRows })}
      hasFiltersOrSearch={hasFiltersOrSearch}
      onClearFilters={clearFilters}
      clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
      toolbar={toolbar}
      bulkBar={
        selectedRows.length > 0 ? (
          <BulkActionsRow
            selectedRows={selectedRows}
            bulkActions={bulkActions}
            onComplete={() => setSelectedRows([])}
          />
        ) : undefined
      }
      enableRowSelection
      onSelectionChange={setSelectedRows}
      onRowClick={onRowClick}
      getRowId={row => row.id}
      rightSlot={renderColumnToggle}
      emptyIcon={<ContractsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      emptyCta={t('empty.cta')}
      onEmptyCta={onNewContract}
      emptyCtaIcon={Plus}
      noResultsTitle={t('noResults.heading')}
      noResultsDescription={t('noResults.body')}
      noResultsCta={t('noResults.cta')}
      skeletonColumns={{
        select: { shape: 'checkbox' },
        title: { shape: 'text', width: 'w-40' },
        contractor: { shape: 'text', width: 'w-36' },
        type: { shape: 'badge' },
        status: { shape: 'badge' },
        startDate: { shape: 'text', width: 'w-24' },
        endDate: { shape: 'text', width: 'w-24' },
        rateValueMinor: { shape: 'text', width: 'w-20' },
        currency: { shape: 'text', width: 'w-12' },
        billingModel: { shape: 'text', width: 'w-20' },
        internalOwner: { shape: 'avatar' },
        complianceRiskLevel: { shape: 'badge' },
      }}
    />
  );
}

/**
 * Custom bulk action bar — renders the contracts-specific Export dropdown +
 * Terminate dialog. Sits above the canonical DataTable via its `toolbar` slot
 * (which contains the filters toolbar first, then this bar when rows are
 * selected). The primitive owns selection state via `enableRowSelection` +
 * `onSelectionChange`; this component receives the row originals directly.
 */
function BulkActionsRow({
  selectedRows,
  bulkActions,
  onComplete,
}: {
  selectedRows: ContractRow[];
  bulkActions: ContractDataTableProps['bulkActions'];
  onComplete: () => void;
}) {
  return (
    <DataTableBulkActions
      selectedRows={selectedRows}
      bulkActions={bulkActions}
      onComplete={onComplete}
    />
  );
}
