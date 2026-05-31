import { ContractorsIllustration, DataTable } from '@contractor-ops/ui';
import type { ColumnDef, SortingState, Table, VisibilityState } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractorListTableProps } from '../hooks/use-contractor-list.js';
import type { ContractorRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';
import { DataTableColumnToggle } from './data-table-column-toggle.js';

const STORAGE_KEY = 'contractor-table-columns';

interface ContractorDataTableProps extends ContractorListTableProps {
  onRowClick: (contractor: ContractorRow) => void;
  onAddContractor: () => void;
  onImport?: () => void;
  parentLoading?: boolean;
  toolbar: ReactNode;
}

export function ContractorDataTable({
  data,
  totalRows,
  users,
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
  onAddContractor,
  parentLoading,
  toolbar,
}: ContractorDataTableProps) {
  const t = useTranslations('Contractors');

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedRows, setSelectedRows] = useState<ContractorRow[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setColumnVisibility(JSON.parse(stored) as VisibilityState);
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

  const columns: ColumnDef<ContractorRow>[] = useMemo(() => getColumns(t), [t]);

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
        onSortChange('createdAt', 'desc');
      }
    },
    [sorting, onSortChange],
  );

  const renderColumnToggle = useCallback(
    (table: Table<ContractorRow>) => <DataTableColumnToggle table={table} />,
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
          <DataTableBulkActions
            selectedRows={selectedRows}
            users={users}
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
      emptyIcon={<ContractorsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      emptyCta={t('empty.cta')}
      onEmptyCta={onAddContractor}
      emptyCtaIcon={Plus}
      noResultsTitle={t('noResults.heading')}
      noResultsDescription={t('noResults.body')}
      noResultsCta={t('noResults.cta')}
      skeletonColumns={{
        select: { shape: 'checkbox' },
        displayName: { shape: 'text', width: 'w-40' },
        type: { shape: 'badge' },
        lifecycleStage: { shape: 'badge' },
        owner: { shape: 'avatar' },
        billingModel: { shape: 'text', width: 'w-20' },
        rate: { shape: 'text', width: 'w-16' },
        currency: { shape: 'text', width: 'w-12' },
        nextInvoice: { shape: 'text', width: 'w-24' },
        teamProject: { shape: 'text', width: 'w-32' },
        contractEnd: { shape: 'text', width: 'w-24' },
        lastActivity: { shape: 'text', width: 'w-24' },
        complianceHealth: { shape: 'badge' },
      }}
    />
  );
}
