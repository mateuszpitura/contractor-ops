'use client';

import { AtelierTableShell } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { PaymentRunRow } from './columns';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentRunDataTableProps {
  data: PaymentRunRow[];
  columns: ColumnDef<PaymentRunRow>[];
  isLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRowClick: (run: PaymentRunRow) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentRunDataTable({
  data,
  columns,
  isLoading,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onRowClick,
}: PaymentRunDataTableProps) {
  const t = useTranslations('Payments');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId: row => row.id,
  });

  const visibleColumns = useMemo(() => table.getVisibleLeafColumns(), [table]);

  return (
    <div className="space-y-4">
      <AtelierTableShell
        isLoading={isLoading}
        footer={
          !isLoading && (hasPreviousPage || hasNextPage) ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPreviousPage}
                disabled={!hasPreviousPage}>
                <ChevronLeft className="h-4 w-4" />
                {t('table.previous')}
              </Button>
              <Button variant="outline" size="sm" onClick={onNextPage} disabled={!hasNextPage}>
                {t('table.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skeleton-${i}`}>
                  {visibleColumns.map(col => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => onRowClick(row.original)}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <SearchX className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">{t('noResults.heading')}</p>
                    <p className="max-w-sm text-xs text-muted-foreground">{t('noResults.body')}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </AtelierTableShell>
    </div>
  );
}
