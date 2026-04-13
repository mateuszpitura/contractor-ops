'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      <div className="rounded-xl border bg-background">
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
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <TableRow key={`skeleton-${i}`}>
                    {visibleColumns.map(col => (
                      <TableCell key={col.id}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.length > 0
                ? table.getRowModel().rows.map(row => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => onRowClick(row.original)}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : null}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && (hasPreviousPage || hasNextPage) && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onPreviousPage} disabled={!hasPreviousPage}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={onNextPage} disabled={!hasNextPage}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
