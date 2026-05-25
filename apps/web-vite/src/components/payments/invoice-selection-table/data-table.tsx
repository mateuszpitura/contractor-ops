/**
 * Invoice selection data table — ported from
 * apps/web/src/components/payments/invoice-selection-table/data-table.tsx.
 */

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
import { useMemo } from 'react';

import type { ReadyInvoiceRow } from './columns.js';

interface InvoiceSelectionDataTableProps {
  data: ReadyInvoiceRow[];
  columns: ColumnDef<ReadyInvoiceRow>[];
  isLoading: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
}

export function InvoiceSelectionDataTable({
  data,
  columns,
  isLoading,
  rowSelection,
  onRowSelectionChange,
}: InvoiceSelectionDataTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { rowSelection },
    onRowSelectionChange: updater => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    enableRowSelection: row => !row.original._inRunNumber,
    getRowId: row => row.id,
  });

  const visibleColumns = useMemo(() => table.getVisibleLeafColumns(), [table]);

  return (
    <div className="overflow-hidden rounded-xl border bg-background min-h-[320px]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  style={
                    header.column.getSize() === 150 ? undefined : { width: header.column.getSize() }
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
            ? Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skeleton-${i}`}>
                  {visibleColumns.map(col => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[100px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.length > 0
              ? table.getRowModel().rows.map(row => {
                  const inRun = !!row.original._inRunNumber;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={inRun ? 'bg-yellow-500/5' : ''}>
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
    </div>
  );
}
