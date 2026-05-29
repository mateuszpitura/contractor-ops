import { AtelierTableShell, TableChrome, WORKBENCH_DATA_TABLE_CLASS } from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';

import { DataTableBody } from './data-table-body.js';
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
}: SimpleDataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const resolvedCount = totalCount ?? data.length;

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
      <AtelierTableShell
        isLoading={isLoading || isRefetching}
        chrome={
          <TableChrome
            totalCount={resolvedCount}
            entityLabel={entityLabel}
            hasActiveFilters={hasFiltersOrSearch}
            clearFiltersLabel={clearFiltersLabel}
            onClearFilters={onClearFilters}
            hideDensityToggle
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
