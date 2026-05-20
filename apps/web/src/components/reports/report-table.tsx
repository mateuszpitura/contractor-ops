'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { SortableTableHead } from '@/components/shared/sortable-table-head';

interface ReportTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  sortBy: string;
  sortOrder: string;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  grandTotalLabel?: string;
  grandTotalValue?: string;
}

export function ReportTable<TData>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onSortChange,
  sortBy,
  sortOrder,
  onRowClick,
  isLoading,
  isFetching,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  grandTotalLabel,
  grandTotalValue,
}: ReportTableProps<TData>) {
  const tAria = useTranslations('Common.aria');
  const tCommon = useTranslations('Common');
  const pageCount = Math.ceil(totalCount / pageSize);

  const sorting = useMemo(() => [{ id: sortBy, desc: sortOrder === 'desc' }], [sortBy, sortOrder]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { sorting },
    onSortingChange: updater => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (first) {
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <div className="relative overflow-hidden rounded-xl border bg-background">
      {/* Refetch overlay */}
      {isFetching && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
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
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
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
          ) : data.length > 0 ? (
            <>
              {table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => onRowClick?.(row.original)}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!!grandTotalLabel && !!grandTotalValue && (
                <TableRow className="border-t-2">
                  <TableCell colSpan={columns.length - 1} className="text-[14px] font-semibold">
                    {grandTotalLabel}
                  </TableCell>
                  <TableCell className="text-[14px] font-semibold">{grandTotalValue}</TableCell>
                </TableRow>
              )}
            </>
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-16 text-center">
                {emptyIcon}
                <h3 className="mt-3 text-[16px] font-medium">{emptyTitle ?? tCommon('noData')}</h3>
                {!!emptyDescription && (
                  <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {tCommon('pagination.page', { page, pageCount, total: totalCount })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}>
              {tCommon('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount}>
              {tCommon('pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
