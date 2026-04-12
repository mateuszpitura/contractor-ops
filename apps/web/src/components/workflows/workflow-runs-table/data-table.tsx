"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, GitBranch, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
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
import { trpc } from "@/trpc/init";
import type { WorkflowRunRow } from "./columns";
import { getColumns } from "./columns";
import { DataTableFilters } from "./data-table-filters";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { useWorkflowFilters } from "./use-workflow-filters";

interface WorkflowRunsDataTableProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
}

/**
 * TanStack Table wrapper for the workflow runs list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function WorkflowRunsDataTable({ onRowClick, onStartWorkflow }: WorkflowRunsDataTableProps) {
  const t = useTranslations("Workflows");
  const tAria = useTranslations("Common.aria");

  // URL-synced filter state
  const [filters, setFilters] = useWorkflowFilters();

  // Row selection state
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Build query input from URL state
  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy: (filters.sortBy as "createdAt" | "dueAt" | "status" | "startedAt") || "dueAt",
      sortOrder: (filters.sortOrder as "asc" | "desc") || "asc",
      filters: {
        status: filters.status.length ? filters.status : undefined,
        templateId: filters.templateId.length ? filters.templateId : undefined,
        overdueOnly: filters.overdueOnly || undefined,
      },
    }),
    [filters],
  );

  // Fetch data via tRPC
  const runsQuery = useQuery({
    ...trpc.workflow.listRuns.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = runsQuery.data as { items: WorkflowRunRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [runsQuery.data]);

  const totalRows = useMemo(() => {
    const result = runsQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [runsQuery.data]);

  // Column definitions
  const columns: ColumnDef<WorkflowRunRow>[] = useMemo(
    () => getColumns((key: string) => t(key as Parameters<typeof t>[0])),
    [t],
  );

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / filters.pageSize),
    state: {
      rowSelection,
      sorting: [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === "desc",
        },
      ],
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater([{ id: filters.sortBy, desc: filters.sortOrder === "desc" }])
          : updater;
      if (next.length > 0) {
        void setFilters({
          sortBy: next[0]!.id,
          sortOrder: next[0]!.desc ? "desc" : "asc",
          page: 1,
        });
      } else {
        // Sort removed — reset to default
        void setFilters({ sortBy: "dueAt", sortOrder: "asc", page: 1 });
      }
    },
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  // Filter change handler
  const handleFiltersChange = useCallback(
    (
      partial: Partial<{
        status: string[];
        templateId: string[];
        overdueOnly: boolean;
      }>,
    ) => {
      void setFilters({ ...partial, page: 1 });
    },
    [setFilters],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      void setFilters({ search: value, page: 1 });
    },
    [setFilters],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      void setFilters({ page });
    },
    [setFilters],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      void setFilters({ pageSize, page: 1 });
    },
    [setFilters],
  );

  // Clear filters for "no results" CTA
  const clearFilters = useCallback(() => {
    void setFilters({
      search: "",
      status: [],
      templateId: [],
      overdueOnly: false,
      page: 1,
    });
  }, [setFilters]);

  const isLoading = runsQuery.isPending && !runsQuery.data;
  const isRefetching = runsQuery.isFetching && !isLoading;
  const hasFiltersOrSearch =
    filters.search.length > 0 ||
    filters.status.length > 0 ||
    filters.templateId.length > 0 ||
    filters.overdueOnly;

  /**
   * Determine if a row is overdue for background highlighting.
   */
  const isRowOverdue = (row: WorkflowRunRow) => {
    if (row.status === "COMPLETED" || row.status === "CANCELLED") return false;
    if (!row.dueAt) return false;
    return new Date(row.dueAt) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: search + start workflow button */}
      <DataTableToolbar
        search={filters.search}
        onSearchChange={handleSearchChange}
        isSearching={isRefetching}
        onStartWorkflow={onStartWorkflow}
      />

      {/* Filters */}
      <DataTableFilters
        filters={{
          status: filters.status,
          templateId: filters.templateId,
          overdueOnly: filters.overdueOnly,
        }}
        onFiltersChange={handleFiltersChange}
      />

      {/* Table */}
      <div className="relative rounded-xl border bg-background">
        {/* Refetch overlay */}
        {isRefetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 uppercase hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                        aria-label={tAria("sortBy", {
                          column:
                            typeof header.column.columnDef.header === "string"
                              ? header.column.columnDef.header
                              : header.id,
                        })}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {table.getVisibleLeafColumns().map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={`cursor-pointer ${
                    isRowOverdue(row.original) ? "bg-destructive/5" : ""
                  }`}
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : hasFiltersOrSearch ? (
              // No search results
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center"
                >
                  <h3 className="text-[16px] font-medium">{t("noResults.heading")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("noResults.body")}</p>
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    {t("noResults.cta")}
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center"
                >
                  <GitBranch className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <h3 className="mt-3 text-[16px] font-medium">{t("empty.heading")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("empty.body")}</p>
                  <Button className="mt-4" onClick={onStartWorkflow}>
                    {t("empty.cta")}
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!isLoading && totalRows > 0 && (
          <DataTablePagination
            table={table}
            totalRows={totalRows}
            pageSize={filters.pageSize}
            currentPage={filters.page}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  );
}
