'use client';

import type { Row, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataTableBodyProps<TData> {
  table: Table<TData>;
  isLoading: boolean;
  hasFiltersOrSearch: boolean;

  /** Callback when a data row is clicked. */
  onRowClick?: (row: TData) => void;

  /** Optional row class name generator (e.g. for overdue highlighting). */
  rowClassName?: (row: TData) => string;

  // Empty / no-results state config
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyCta?: string;
  onEmptyCta?: () => void;
  noResultsTitle: string;
  noResultsDescription?: string;
  noResultsCta?: string;
  onClearFilters?: () => void;

  /** Number of skeleton rows to show while loading (default: 8). */
  skeletonRows?: number;
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows<TData>({ table, count }: { table: Table<TData>; count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <TableRow key={`skeleton-${i}`}>
          {table.getVisibleLeafColumns().map(col => (
            <TableCell key={col.id}>
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  colSpan,
  icon,
  title,
  description,
  cta,
  onCta,
}: {
  colSpan: number;
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-16 text-center">
        {icon}
        <h3 className="mt-3 text-[16px] font-medium">{title}</h3>
        {!!description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {!!cta && !!onCta && (
          <Button className="mt-4" onClick={onCta}>
            {cta}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// No-results state
// ---------------------------------------------------------------------------

function NoResultsState({
  colSpan,
  title,
  description,
  cta,
  onClearFilters,
}: {
  colSpan: number;
  title: string;
  description?: string;
  cta?: string;
  onClearFilters?: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-16 text-center">
        <h3 className="text-[16px] font-medium">{title}</h3>
        {!!description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {!!cta && !!onClearFilters && (
          <Button variant="outline" className="mt-4" onClick={onClearFilters}>
            {cta}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Data rows
// ---------------------------------------------------------------------------

function DataRows<TData>({
  rows,
  onRowClick,
  rowClassName,
}: {
  rows: Row<TData>[];
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
}) {
  return (
    <>
      {rows.map(row => (
        <TableRow
          key={row.id}
          data-state={row.getIsSelected() ? 'selected' : undefined}
          className={`${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row.original) ?? ''}`}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={onRowClick ? () => onRowClick(row.original) : undefined}>
          {row.getVisibleCells().map(cell => (
            <TableCell key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Shared table body that handles loading skeletons, data rows, empty state,
 * and no-results state. Used across all data-table components.
 */
export function DataTableBody<TData>({
  table,
  isLoading,
  hasFiltersOrSearch,
  onRowClick,
  rowClassName,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyCta,
  onEmptyCta,
  noResultsTitle,
  noResultsDescription,
  noResultsCta,
  onClearFilters,
  skeletonRows = 8,
}: DataTableBodyProps<TData>) {
  const colSpan = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <TableBody>
      {isLoading ? (
        <SkeletonRows table={table} count={skeletonRows} />
      ) : rows.length > 0 ? (
        <DataRows rows={rows} onRowClick={onRowClick} rowClassName={rowClassName} />
      ) : hasFiltersOrSearch ? (
        <NoResultsState
          colSpan={colSpan}
          title={noResultsTitle}
          description={noResultsDescription}
          cta={noResultsCta}
          onClearFilters={onClearFilters}
        />
      ) : (
        <EmptyState
          colSpan={colSpan}
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          cta={emptyCta}
          onCta={onEmptyCta}
        />
      )}
    </TableBody>
  );
}
