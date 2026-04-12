'use client';

import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ReadyInvoiceRow } from './columns';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InvoiceSelectionDataTableProps {
  data: ReadyInvoiceRow[];
  columns: ColumnDef<ReadyInvoiceRow>[];
  isLoading: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    <div className="rounded-xl border bg-background min-h-[320px]">
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
