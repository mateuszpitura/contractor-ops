import { ContractorsIllustration } from '@contractor-ops/ui';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { ColumnDef, Table } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractorListTableProps } from '../hooks/use-contractor-list.js';
import type { ContractorRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';
import { DataTableColumnToggle } from './data-table-column-toggle.js';

interface ContractorDataTableProps extends ContractorListTableProps {
  onRowClick: (contractor: ContractorRow) => void;
  onAddContractor: () => void;
  onImport?: () => void;
  parentLoading?: boolean;
  toolbar: ReactNode;
  sectionClassName?: string;
}

export function ContractorDataTable({
  data,
  totalRows,
  users,
  filters,
  onPageChange,
  onPageSizeChange,
  clearFilters,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  bulkActions,
  columnVisibility,
  setColumnVisibility,
  sorting,
  onSortingChange,
  selectedRows,
  setSelectedRows,
  onRowClick,
  onAddContractor,
  parentLoading,
  toolbar,
  sectionClassName,
}: ContractorDataTableProps) {
  const t = useTranslations('Contractors');

  const columns: ColumnDef<ContractorRow>[] = useMemo(() => getColumns(t), [t]);

  const renderColumnToggle = useCallback(
    (table: Table<ContractorRow>) => <DataTableColumnToggle table={table} />,
    [],
  );

  return (
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={data}
      totalRows={totalRows}
      pageIndex={Math.max(0, filters.page - 1)}
      pageSize={filters.pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
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
