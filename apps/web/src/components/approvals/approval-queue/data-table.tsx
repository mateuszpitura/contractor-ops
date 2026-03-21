"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ApprovalQueueRow } from "./columns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalQueueTableProps {
  data: ApprovalQueueRow[];
  columns: ColumnDef<ApprovalQueueRow>[];
  pageCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (row: ApprovalQueueRow) => void;
  onSelectionChange?: (ids: string[]) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function isOverdue(row: ApprovalQueueRow): boolean {
  if (row.status !== "PENDING" || !row.slaDeadline) return false;
  return new Date(row.slaDeadline).getTime() < Date.now();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TanStack Table wrapper for the approval queue.
 * Uses server-side pagination. Mirrors the contract-table pattern.
 */
export function ApprovalQueueTable({
  data,
  columns,
  pageCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onSelectionChange,
  isLoading,
}: ApprovalQueueTableProps) {
  const t = useTranslations("Approvals");

  // Row selection state managed locally, forwarded to parent via callback
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Reset selection when data changes (page/filter change)
  useEffect(() => {
    setRowSelection({});
  }, [data]);

  // Forward selection changes to parent
  useEffect(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k]);
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
    getRowId: (row) => row.id,
  });

  const totalPages = pageCount;

  return (
    <div className="space-y-0">
      {/* Table */}
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap text-[12px]"
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // 8 skeleton loading rows per UI-SPEC
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const overdue = isOverdue(row.original);
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={`group cursor-pointer ${overdue ? "bg-destructive/5" : ""}`}
                    onClick={() => onRowClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 0 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("pagination.rowsPerPage")}
            </span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-16 rounded-md border bg-background px-2 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("pagination.pageOf", { current: page, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t("pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t("pagination.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
