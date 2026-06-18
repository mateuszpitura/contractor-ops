import type { Row, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { Fragment, useCallback } from 'react';

import { TableBody, TableCell, TableRow } from '../../shadcn/table.js';
import { EmptyStateRow } from './empty-state-row.js';
import { NoResultsRow } from './no-results-row.js';
import { shouldIgnoreRowClick } from './row-click.js';
import { SkeletonRows } from './skeleton-row.js';
import type { SkeletonColumnShape } from './types.js';

interface DataTableBodyProps<TData> {
  table: Table<TData>;
  isLoading: boolean;
  forceLoading?: boolean;
  hasFiltersOrSearch: boolean;

  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;

  // Row expansion
  renderSubRow?: (row: TData) => ReactNode;
  expandedRowIds?: Record<string, boolean>;

  // Empty (compact tier) — first-class lists short-circuit before reaching the body.
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyCta?: string;
  onEmptyCta?: () => void;
  emptyCtaIcon?: ComponentType<{ className?: string }>;

  // No results
  noResultsTitle: string;
  noResultsDescription?: string;
  noResultsCta?: string;
  onClearFilters?: () => void;

  skeletonRows?: number;
  skeletonColumns?: Record<string, SkeletonColumnShape>;
}

function DataRow<TData>({
  row,
  onRowClick,
  rowClassName,
}: {
  row: Row<TData>;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
}) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLTableRowElement>) => {
      if (!onRowClick) return;
      if (shouldIgnoreRowClick(event)) return;
      onRowClick(row.original);
    },
    [onRowClick, row.original],
  );
  return (
    <TableRow
      data-state={row.getIsSelected() ? 'selected' : undefined}
      className={`${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row.original) ?? ''}`}
      onClick={onRowClick ? handleClick : undefined}>
      {row.getVisibleCells().map(cell => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function DataTableBody<TData>({
  table,
  isLoading,
  forceLoading,
  hasFiltersOrSearch,
  onRowClick,
  rowClassName,
  renderSubRow,
  expandedRowIds,
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
        rows.map(row => {
          const subRow =
            renderSubRow && expandedRowIds?.[row.id] ? renderSubRow(row.original) : null;
          return (
            <Fragment key={row.id}>
              <DataRow row={row} onRowClick={onRowClick} rowClassName={rowClassName} />
              {subRow == null ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="p-0">
                    {subRow}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })
      ) : hasFiltersOrSearch ? (
        <NoResultsRow
          colSpan={colSpan}
          title={noResultsTitle}
          description={noResultsDescription}
          cta={noResultsCta}
          onClearFilters={onClearFilters}
        />
      ) : (
        <EmptyStateRow
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
