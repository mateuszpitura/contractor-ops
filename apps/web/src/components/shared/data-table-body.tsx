'use client';

import type { Row, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { FilterX, SearchX } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape descriptor for a single skeleton column. Allows the SkeletonRow
 * to mimic the actual column's visual weight instead of rendering a
 * uniform 120px rectangle for every cell. Map by `columnId` (TanStack
 * column id) — any unmapped column falls back to the default text
 * shape.
 */
export type SkeletonColumnShape = {
  /** Visual shape — drives skeleton dimensions + radius. */
  shape?: 'text' | 'badge' | 'avatar' | 'actions' | 'checkbox';
  /** Tailwind width class override (e.g. 'w-32', 'w-1/2'). Used by 'text' shape only. */
  width?: string;
};

interface DataTableBodyProps<TData> {
  table: Table<TData>;
  isLoading: boolean;
  /**
   * When true, render SkeletonRows even if `isLoading` is false. Used by
   * pages that have a separate count query — while the count is in flight
   * we keep the table in skeleton state so DataTableBody never flashes its
   * in-table empty state before the page swaps to AtelierEmptyState.
   */
  forceLoading?: boolean;
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
  /** Optional icon component rendered before the empty-state CTA label. */
  emptyCtaIcon?: ComponentType<{ className?: string }>;
  noResultsTitle: string;
  noResultsDescription?: string;
  noResultsCta?: string;
  onClearFilters?: () => void;

  /** Number of skeleton rows to show while loading (default: 8). */
  skeletonRows?: number;

  /**
   * Optional per-column skeleton shape descriptors keyed by TanStack column id.
   * When omitted the skeleton falls back to the legacy uniform shape. Use
   * this to align skeleton dimensions with real column content (avatars,
   * badges, narrow checkbox/action cells, etc.).
   */
  skeletonColumns?: Record<string, SkeletonColumnShape>;
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function skeletonClassForShape(descriptor: SkeletonColumnShape | undefined): string {
  if (!descriptor) return 'h-4 w-full max-w-[120px]';
  switch (descriptor.shape) {
    case 'checkbox':
      return 'h-4 w-4 rounded-sm';
    case 'avatar':
      return 'h-7 w-7 rounded-full';
    case 'badge':
      return 'h-5 w-16 rounded-full';
    case 'actions':
      return 'ms-auto h-4 w-4 rounded-sm';
    default:
      return `h-4 ${descriptor.width ?? 'w-full max-w-[120px]'}`;
  }
}

function SkeletonRows<TData>({
  table,
  count,
  columns,
}: {
  table: Table<TData>;
  count: number;
  columns?: Record<string, SkeletonColumnShape>;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <TableRow key={`skeleton-${i}`}>
          {table.getVisibleLeafColumns().map(col => (
            <TableCell key={col.id}>
              <Skeleton className={skeletonClassForShape(columns?.[col.id])} />
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
  ctaIcon: CtaIcon,
}: {
  colSpan: number;
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: string;
  onCta?: () => void;
  ctaIcon?: ComponentType<{ className?: string }>;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-20">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          {!!icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              {icon}
            </div>
          )}
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
          {!!description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
          {!!cta && !!onCta && (
            <Button size="sm" className="mt-5" onClick={onCta}>
              {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" /> : null}
              {cta}
            </Button>
          )}
        </div>
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
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-20">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
            <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
          {!!description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
          {!!cta && !!onClearFilters && (
            <Button variant="outline" size="sm" className="mt-5" onClick={onClearFilters}>
              <FilterX className="h-3.5 w-3.5" />
              {cta}
            </Button>
          )}
        </div>
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
  forceLoading,
  hasFiltersOrSearch,
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
  onClearFilters,
  skeletonRows = 8,
  skeletonColumns,
}: DataTableBodyProps<TData>) {
  const colSpan = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const showSkeleton = isLoading || forceLoading === true;

  return (
    <TableBody>
      {showSkeleton ? (
        <SkeletonRows table={table} count={skeletonRows} columns={skeletonColumns} />
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
          ctaIcon={emptyCtaIcon}
        />
      )}
    </TableBody>
  );
}
