import {
  AtelierTableShell,
  ContractsIllustration,
  TableChrome,
  WORKBENCH_DATA_TABLE_CLASS,
} from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import { SortableTableHead } from '../../shared/sortable-table-head.js';
import type { ContractListTableProps } from '../hooks/use-contract-list.js';
import type { ContractRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';
import { DataTableColumnToggle } from './data-table-column-toggle.js';
import { DataTablePagination } from './data-table-pagination.js';

const STORAGE_KEY = 'contract-table-columns';

interface ContractDataTableProps extends ContractListTableProps {
  onRowClick: (contract: ContractRow) => void;
  onNewContract: () => void;
  onImport?: () => void;
  parentLoading?: boolean;
  toolbar: ReactNode;
}

/**
 * Presentational TanStack Table for the contract list.
 * Data fetching lives in `useContractList` via container props.
 */
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
  const tAria = useTranslations('Common.aria');

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setColumnVisibility(JSON.parse(stored) as VisibilityState);
      }
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
    } catch {
      // Ignore localStorage errors
    }
  }, [columnVisibility]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns: ColumnDef<ContractRow>[] = useMemo(() => getColumns(t, formatDate), [t]);

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / filters.pageSize),
    state: {
      columnVisibility,
      rowSelection,
      sorting: [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === 'desc',
        },
      ],
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: updater => {
      const next =
        typeof updater === 'function'
          ? updater([{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }])
          : updater;
      const first = next[0];
      if (first) {
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      } else {
        onSortChange('endDate', 'asc');
      }
    },
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getRowId: row => row.id,
  });

  const deselectAll = useCallback(() => {
    table.toggleAllPageRowsSelected(false);
  }, [table]);

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
      <div className="shrink-0">{toolbar}</div>

      <div className="shrink-0">
        <DataTableBulkActions table={table} bulkActions={bulkActions} onComplete={deselectAll} />
      </div>

      <AtelierTableShell
        isLoading={isLoading || isRefetching || parentLoading === true}
        chrome={
          <TableChrome
            totalCount={totalRows}
            entityLabel={t('entityLabel', { count: totalRows })}
            hasActiveFilters={hasFiltersOrSearch}
            clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
            onClearFilters={clearFilters}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
            rightSlot={<DataTableColumnToggle table={table} />}
          />
        }
        footer={
          !isLoading && totalRows > 0 ? (
            <DataTablePagination
              table={table}
              totalRows={totalRows}
              pageSize={filters.pageSize}
              currentPage={filters.page}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          ) : undefined
        }>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <SortableTableHead
                    key={header.id}
                    header={header}
                    sortAriaLabel={tAria('sortBy', {
                      column:
                        typeof header.column.columnDef.header === 'string'
                          ? header.column.columnDef.header
                          : header.id,
                    })}
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            forceLoading={parentLoading}
            hasFiltersOrSearch={hasFiltersOrSearch}
            onRowClick={onRowClick}
            emptyIcon={<ContractsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onNewContract}
            emptyCtaIcon={Plus}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
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
        </Table>
      </AtelierTableShell>
    </div>
  );
}
