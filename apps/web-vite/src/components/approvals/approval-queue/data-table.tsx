import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AtelierTableShell
        isLoading={isLoading}
        chrome={
          <TableChrome
            totalCount={totalCount ?? data.length}
            entityLabel={t('entityLabel', { count: totalCount ?? data.length })}
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
            <div className="flex items-center justify-between px-2 py-4">
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
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap text-[12px]"
                    style={
                      header.column.getSize() === 150
                        ? undefined
                        : { width: header.column.getSize() }
                    }>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((_, colIdx) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                      <TableCell key={colIdx}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.length > 0
                ? table.getRowModel().rows.map(row => {
                    const overdue = isOverdue(row.original);
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() ? 'selected' : undefined}
                        className={`group cursor-pointer ${overdue ? 'bg-destructive/5' : ''}`}
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() => onRowClick(row.original)}>
                        {row.getVisibleCells().map(cell => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                : null}
          </TableBody>
        </Table>
      </AtelierTableShell>
    </div>
  );
}
