import { AtelierTableShell, NoResultsIllustration, TableChrome } from '@contractor-ops/ui';
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
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { PaymentRunRow } from './columns.js';

interface PaymentRunDataTableProps {
  data: PaymentRunRow[];
  columns: ColumnDef<PaymentRunRow>[];
  isLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRowClick: (run: PaymentRunRow) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  activeFilterCount?: number;
}

export function PaymentRunDataTable({
  data,
  columns,
  isLoading,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onRowClick,
  hasActiveFilters,
  onClearFilters,
  activeFilterCount = 0,
}: PaymentRunDataTableProps) {
  const t = useTranslations('Payments');
  const tAria = useTranslations('Common.aria');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId: row => row.id,
  });

  const visibleColumns = useMemo(() => table.getVisibleLeafColumns(), [table]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AtelierTableShell
        isLoading={isLoading}
        chrome={
          <TableChrome
            totalCount={data.length}
            entityLabel={t('entityLabel', { count: data.length })}
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
                    <NoResultsIllustration
                      className="h-16 w-16 text-primary/60"
                      aria-hidden="true"
                    />
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
