import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DataTableBody } from '../../shared/data-table-body.js';
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

const PAGE_SIZE_OPTIONS = [10, 25, 50];

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
            <div className="flex flex-wrap items-center justify-end gap-4 px-2 py-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('pagination.rowsPerPage')}</span>
                <select
                  value={pageSize}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={e => onPageSizeChange(Number(e.target.value))}
                  className="h-8 w-16 rounded-md border bg-background px-2 text-sm">
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t('pagination.pageOf', { current: page, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => onPageChange(page - 1)}>
                  {t('pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => onPageChange(page + 1)}>
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
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
