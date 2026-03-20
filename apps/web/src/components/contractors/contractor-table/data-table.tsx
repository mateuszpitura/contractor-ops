"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
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

import { getColumns, type ContractorRow } from "./columns";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableColumnToggle } from "./data-table-column-toggle";
import { DataTableBulkActions } from "./data-table-bulk-actions";
import { useContractorFilters } from "./use-contractor-filters";

const STORAGE_KEY = "contractor-table-columns";

interface ContractorDataTableProps {
  onRowClick: (contractor: ContractorRow) => void;
  onAddContractor: () => void;
}

/**
 * TanStack Table wrapper for the contractor list.
 * Uses server-side pagination, sorting, and filtering via tRPC.
 * URL state is managed by nuqs for shareable filtered views.
 */
export function ContractorDataTable({
  onRowClick,
  onAddContractor,
}: ContractorDataTableProps) {
  const t = useTranslations("Contractors");

  // URL-synced filter state
  const [filters, setFilters] = useContractorFilters();

  // Column visibility from localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? (JSON.parse(stored) as VisibilityState) : {};
      } catch {
        return {};
      }
    },
  );

  // Persist column visibility
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch {
      // Ignore localStorage errors
    }
  }, [columnVisibility]);

  // Row selection state
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Build query input from URL state
  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy: (filters.sortBy as "createdAt" | "legalName" | "status" | "lifecycleStage" | "type") || "createdAt",
      sortOrder: (filters.sortOrder as "asc" | "desc") || "desc",
      filters: {
        lifecycleStage: filters.lifecycleStage.length
          ? (filters.lifecycleStage as Array<"DRAFT" | "ONBOARDING" | "ACTIVE" | "OFFBOARDING" | "ENDED">)
          : undefined,
        ownerUserId: filters.owner.length ? filters.owner : undefined,
        primaryTeamId: filters.team.length ? filters.team : undefined,
        billingModel: filters.billingModel.length
          ? filters.billingModel
          : undefined,
        complianceHealth: filters.health.length
          ? (filters.health as Array<"green" | "yellow" | "red">)
          : undefined,
      },
    }),
    [filters],
  );

  // Fetch data
  const contractorsQuery = useQuery(
    trpc.contractor.list.queryOptions(queryInput),
  );

  const data = useMemo(() => {
    const result = contractorsQuery.data as
      | { items: ContractorRow[]; total: number }
      | undefined;
    return result?.items ?? [];
  }, [contractorsQuery.data]);

  const totalRows = useMemo(() => {
    const result = contractorsQuery.data as
      | { items: unknown[]; total: number }
      | undefined;
    return result?.total ?? 0;
  }, [contractorsQuery.data]);

  // Column definitions
  const columns: ColumnDef<ContractorRow>[] = useMemo(
    () => getColumns((key: string) => t(key as Parameters<typeof t>[0])),
    [t],
  );

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / filters.pageSize),
    state: {
      columnVisibility,
      rowSelection,
      sorting: [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === "desc",
        },
      ],
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater([
              { id: filters.sortBy, desc: filters.sortOrder === "desc" },
            ])
          : updater;
      if (next.length > 0) {
        void setFilters({
          sortBy: next[0]!.id,
          sortOrder: next[0]!.desc ? "desc" : "asc",
          page: 1,
        });
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  // Filter change handler
  const handleFiltersChange = useCallback(
    (partial: Partial<{
      status: string[];
      lifecycleStage: string[];
      owner: string[];
      team: string[];
      billingModel: string[];
      health: string[];
    }>) => {
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
      lifecycleStage: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
      page: 1,
    });
  }, [setFilters]);

  const isLoading = contractorsQuery.isLoading;
  const isSearching = contractorsQuery.isFetching && !isLoading;
  const hasFiltersOrSearch =
    filters.search.length > 0 ||
    filters.lifecycleStage.length > 0 ||
    filters.owner.length > 0 ||
    filters.billingModel.length > 0 ||
    filters.health.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: search, filters, add button */}
      <DataTableToolbar
        search={filters.search}
        onSearchChange={handleSearchChange}
        filters={{
          status: filters.status,
          lifecycleStage: filters.lifecycleStage,
          owner: filters.owner,
          team: filters.team,
          billingModel: filters.billingModel,
          health: filters.health,
        }}
        onFiltersChange={handleFiltersChange}
        isSearching={isSearching}
        onAddContractor={onAddContractor}
      />

      {/* Bulk actions bar */}
      <DataTableBulkActions table={table} />

      {/* Table */}
      <div className="rounded-xl border bg-background">
        <div className="flex items-center justify-end border-b px-4 py-2">
          <DataTableColumnToggle table={table} />
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap text-[13px]"
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
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
                  {table
                    .getVisibleLeafColumns()
                    .map((col) => (
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
                  className="cursor-pointer"
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
              ))
            ) : hasFiltersOrSearch ? (
              // No search results
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center"
                >
                  <h3 className="text-[16px] font-medium">
                    {t("noResults.heading")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("noResults.body")}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={clearFilters}
                  >
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
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <h3 className="mt-3 text-[16px] font-medium">
                    {t("empty.heading")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("empty.body")}
                  </p>
                  <Button className="mt-4" onClick={onAddContractor}>
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
