import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import { DataTablePagination } from '../../shared/data-table-pagination.js';
import { SortableTableHead } from '../../shared/sortable-table-head.js';
import type { ApprovalQueueRow } from './columns.js';

interface ApprovalQueueTableProps {
  data: ApprovalQueueRow[];
  columns: ColumnDef<ApprovalQueueRow>[];
  pageCount: number;
  page: number;
  pageSize: number;
  totalCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  activeFilterCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (row: ApprovalQueueRow) => void;
  onSelectionChange?: (ids: string[]) => void;
  isLoading?: boolean;
}

function isOverdue(row: ApprovalQueueRow): boolean {
  if (row.status !== 'PENDING' || !row.slaDeadline) return false;
  return new Date(row.slaDeadline).getTime() < Date.now();
}

export function ApprovalQueueTable({
  data,
  columns,
  pageCount,
  page,
  pageSize,
  totalCount,
  hasActiveFilters,
  onClearFilters,
  activeFilterCount = 0,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onSelectionChange,
  isLoading,
}: ApprovalQueueTableProps) {
  const t = useTranslations('Approvals');
  const tAria = useTranslations('Common.aria');

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    setRowSelection({});
  }, []);

  useEffect(() => {
    const ids = Object.keys(rowSelection).filter(k => rowSelection[k]);
    onSelectionChange?.(ids);
  }, [rowSelection, onSelectionChange]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    enableRowSelection: true,
    getRowId: row => row.id,
  });

  const totalPages = pageCount;
  const resolvedTotal = totalCount ?? data.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AtelierTableShell
        isLoading={isLoading}
        chrome={
          <TableChrome
            totalCount={resolvedTotal}
            entityLabel={t('entityLabel', { count: resolvedTotal })}
            hasActiveFilters={hasActiveFilters}
            clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
            onClearFilters={onClearFilters}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }
        footer={
          !isLoading && totalPages > 0 ? (
            <DataTablePagination
              table={table}
              totalRows={resolvedTotal}
              pageSize={pageSize}
              currentPage={page}
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
                  <SortableTableHead key={header.id} header={header} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading ?? false}
            hasFiltersOrSearch={Boolean(hasActiveFilters)}
            onRowClick={onRowClick}
            rowClassName={row => `group ${isOverdue(row) ? 'bg-destructive/5' : ''}`}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={onClearFilters}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
