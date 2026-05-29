import { AtelierTableShell, TableChrome, WORKBENCH_DATA_TABLE_CLASS } from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';

import { DataTableBody } from './data-table-body.js';
import { DataTablePagination } from './data-table-pagination.js';
import { SortableTableHead } from './sortable-table-head.js';

interface SimpleDataTableProps<TData> {
  /** TanStack column definitions. */
  columns: ColumnDef<TData, unknown>[];
  /** Current rows (already paginated/filtered upstream). */
  data: TData[];
  /** Server total — drives the chrome count strip. Falls back to `data.length`. */
  totalCount?: number;
  /** Localized pluralized entity label (e.g. "projects"). */
  entityLabel: string;
  /** Loading flag — drives skeletons + overlay. */
  isLoading?: boolean;
  /** Refetch indicator — overlays the shell without replacing rows. */
  isRefetching?: boolean;
  /** True when user has typed a search or applied filters — toggles empty vs no-results. */
  hasFiltersOrSearch?: boolean;
  /** Clear-filters affordance in chrome + no-results CTA. */
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  /** Row click handler. */
  onRowClick?: (row: TData) => void;
  /** Optional row class generator (e.g. status highlighting). */
  rowClassName?: (row: TData) => string;
  /** Empty-state config (no rows, no filters). */
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyCta?: string;
  onEmptyCta?: () => void;
  emptyCtaIcon?: ComponentType<{ className?: string }>;
  /** No-results state (search/filters active, zero rows). */
  noResultsTitle: string;
  noResultsDescription?: string;
  noResultsCta?: string;
  /** Slot rendered on chrome right side (e.g. column visibility). Defaults to none. */
  rightSlot?: ReactNode;
  /** Sort aria-label translator passed to each SortableTableHead. */
  sortAriaLabel?: string;
  /** Skeleton row count (default 6 — smaller than canonical's 8 for compact tables). */
  skeletonRows?: number;
  /**
   * Pass-through to AtelierTableShell.constrainHeight (default true). Set to
   * false when the table is rendered inside a parent that is NOT a flex
   * column with `min-h-0 flex-1` (e.g. inside a Tab panel, dialog body, or
   * regular block flow) — otherwise the shell will try to grow to fill its
   * container and push the entire page into a scroll.
   */
  constrainHeight?: boolean;
  /**
   * Initial client-side page size. When set, the table installs a
   * `getPaginationRowModel`, renders the canonical DataTablePagination footer
   * (page-size selector + Page X of Y + Prev/Next chevrons), and slices the
   * `data` array per page locally. Use for small/static lists where the
   * server returns everything in one batch (organization configs, workflow
   * roles, settings sub-tables). For server-side pagination, build the
   * paginator inline alongside AtelierTableShell instead.
   */
  pageSize?: number;
  /** Override the page-size options for the local paginator. Defaults to [10, 25, 50]. */
  pageSizeOptions?: number[];
}

/**
 * Shared table primitive for small/static surfaces — organization configs,
 * settings tables, and other non-paginated lists. Uses the same chrome,
 * body, and sort affordances as the canonical paginated DataTable so every
 * data surface in the app reads as one visual family.
 *
 * Differences from the full DataTable:
 *   - no pagination footer (caller is expected to fetch a bounded page)
 *   - density toggle hidden (compact-only)
 *   - no bulk actions / column visibility by default (pass `rightSlot` if needed)
 *   - client-side sorting via getSortedRowModel
 */
export function SimpleDataTable<TData>({
  columns,
  data,
  totalCount,
  entityLabel,
  isLoading = false,
  isRefetching = false,
  hasFiltersOrSearch = false,
  onClearFilters,
  clearFiltersLabel,
  onRowClick,
  rowClassName,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyCta,
  onEmptyCta,
  emptyCtaIcon,
  noResultsTitle,
  noResultsDescription,
  noResultsCta,
  rightSlot,
  sortAriaLabel,
  skeletonRows = 6,
  constrainHeight = true,
  pageSize,
  pageSizeOptions,
}: SimpleDataTableProps<TData>) {
  const paginated = typeof pageSize === 'number';

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(paginated
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageIndex: 0, pageSize } },
        }
      : {}),
  });

  const resolvedCount = totalCount ?? data.length;
  const wrapperClass = constrainHeight ? WORKBENCH_DATA_TABLE_CLASS : 'flex flex-col gap-4';

  const livePagination = table.getState().pagination;
  const paginationFooter =
    paginated && data.length > 0 ? (
      <DataTablePagination
        table={table}
        totalRows={data.length}
        pageSize={livePagination.pageSize}
        currentPage={livePagination.pageIndex + 1}
        // biome-ignore lint/nursery/noJsxPropsBind: TanStack callback
        onPageChange={page => table.setPageIndex(page - 1)}
        // biome-ignore lint/nursery/noJsxPropsBind: TanStack callback
        onPageSizeChange={size => table.setPageSize(size)}
        pageSizeOptions={pageSizeOptions}
      />
    ) : null;

  return (
    <div className={wrapperClass}>
      <AtelierTableShell
        constrainHeight={constrainHeight}
        isLoading={isLoading || isRefetching}
        footer={paginationFooter}
        chrome={
          <TableChrome
            totalCount={resolvedCount}
            entityLabel={entityLabel}
            hasActiveFilters={hasFiltersOrSearch}
            clearFiltersLabel={clearFiltersLabel}
            onClearFilters={onClearFilters}
            rightSlot={rightSlot}
          />
        }>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <SortableTableHead
                    key={header.id}
                    header={header}
                    sortAriaLabel={sortAriaLabel}
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            hasFiltersOrSearch={hasFiltersOrSearch}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
            emptyIcon={emptyIcon}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyCta={emptyCta}
            onEmptyCta={onEmptyCta}
            emptyCtaIcon={emptyCtaIcon}
            noResultsTitle={noResultsTitle}
            noResultsDescription={noResultsDescription}
            noResultsCta={noResultsCta}
            onClearFilters={onClearFilters}
            skeletonRows={skeletonRows}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
