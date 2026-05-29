// @ts-nocheck — vendored from reui registry; types relaxed pending upstream verbatimModuleSyntax fix
'use client';

import type { Table } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type React from 'react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { cn } from '../../../lib/utils.js';
import { Button } from '../../shadcn/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shadcn/select.js';
import { Skeleton } from '../../shadcn/skeleton.js';
import { useDataGrid } from './data-grid.js';

function DataGridPaginationPageButton({
  pageIndex,
  table,
  targetIndex,
  className,
}: {
  pageIndex: number;
  table: Table<unknown>;
  targetIndex: number;
  className: string;
}) {
  const isActive = pageIndex === targetIndex;
  const handleClick = useCallback(() => {
    if (!isActive) table.setPageIndex(targetIndex);
  }, [isActive, table, targetIndex]);

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className={cn(className, 'text-muted-foreground', {
        'bg-accent text-accent-foreground': isActive,
      })}
      onClick={handleClick}>
      {targetIndex + 1}
    </Button>
  );
}

interface DataGridPaginationProps {
  sizes?: number[];
  sizesInfo?: string;
  sizesLabel?: string;
  sizesDescription?: string;
  sizesSkeleton?: ReactNode;
  more?: boolean;
  moreLimit?: number;
  info?: string;
  infoSkeleton?: ReactNode;
  className?: string;
  rowsPerPageLabel?: string;
  previousPageLabel?: string;
  nextPageLabel?: string;
  ellipsisText?: string;
}

function DataGridPagination(props: DataGridPaginationProps): React.JSX.Element {
  const { table, recordCount, isLoading } = useDataGrid();

  const defaultProps: Partial<DataGridPaginationProps> = {
    sizes: [5, 10, 25, 50, 100],
    sizesLabel: 'Show',
    sizesDescription: 'per page',
    sizesSkeleton: <Skeleton className="h-8 w-44" />,
    moreLimit: 5,
    more: false,
    info: '{from} - {to} of {count}',
    infoSkeleton: <Skeleton className="h-8 w-60" />,
    rowsPerPageLabel: 'Rows per page',
    previousPageLabel: 'Go to previous page',
    nextPageLabel: 'Go to next page',
    ellipsisText: '...',
  };

  const mergedProps: DataGridPaginationProps = { ...defaultProps, ...props };

  const btnBaseClasses = 'size-7 p-0 text-sm';
  const btnArrowClasses = `${btnBaseClasses} rtl:transform rtl:rotate-180`;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, recordCount);
  const pageCount = table.getPageCount();

  // Replace placeholders in paginationInfo
  const paginationInfo = mergedProps?.info
    ? mergedProps.info
        .replace('{from}', from.toString())
        .replace('{to}', to.toString())
        .replace('{count}', recordCount.toString())
    : `${from} - ${to} of ${recordCount}`;

  // Pagination limit logic
  const paginationMoreLimit = mergedProps?.moreLimit || 5;

  // Determine the start and end of the pagination group
  const currentGroupStart = Math.floor(pageIndex / paginationMoreLimit) * paginationMoreLimit;
  const currentGroupEnd = Math.min(currentGroupStart + paginationMoreLimit, pageCount);

  const handleEllipsisPrev = useCallback(
    () => table.setPageIndex(currentGroupStart - 1),
    [currentGroupStart, table],
  );
  const handleEllipsisNext = useCallback(
    () => table.setPageIndex(currentGroupEnd),
    [currentGroupEnd, table],
  );
  const handlePageSizeChange = useCallback(
    (value: string) => table.setPageSize(Number(value)),
    [table],
  );
  const handlePreviousPage = useCallback(() => table.previousPage(), [table]);
  const handleNextPage = useCallback(() => table.nextPage(), [table]);

  // Render page buttons based on the current group
  const renderPageButtons = () => {
    const buttons: ReactNode[] = [];
    for (let i = currentGroupStart; i < currentGroupEnd; i++) {
      buttons.push(
        <DataGridPaginationPageButton
          key={i}
          pageIndex={pageIndex}
          table={table}
          targetIndex={i}
          className={btnBaseClasses}
        />,
      );
    }
    return buttons;
  };

  // Render a "previous" ellipsis button if there are previous pages to show
  const renderEllipsisPrevButton = () => {
    if (currentGroupStart > 0) {
      return (
        <Button
          size="icon-sm"
          className={btnBaseClasses}
          variant="ghost"
          onClick={handleEllipsisPrev}>
          {mergedProps.ellipsisText}
        </Button>
      );
    }
    return null;
  };

  // Render a "next" ellipsis button if there are more pages to show after the current group
  const renderEllipsisNextButton = () => {
    if (currentGroupEnd < pageCount) {
      return (
        <Button
          className={btnBaseClasses}
          variant="ghost"
          size="icon-sm"
          onClick={handleEllipsisNext}>
          {mergedProps.ellipsisText}
        </Button>
      );
    }
    return null;
  };

  return (
    <div
      data-slot="data-grid-pagination"
      className={cn(
        'flex grow flex-col flex-wrap items-center justify-between gap-2.5 py-2.5 sm:flex-row sm:py-0',
        mergedProps?.className,
      )}>
      <div className="order-2 flex flex-wrap items-center space-x-2.5 rtl:space-x-reverse pb-2.5 sm:order-1 sm:pb-0">
        {isLoading ? (
          mergedProps?.sizesSkeleton
        ) : (
          <>
            <div className="text-muted-foreground text-sm">{mergedProps.rowsPerPageLabel}</div>
            <Select value={`${pageSize}`} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-14" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" className="min-w-18">
                {mergedProps?.sizes?.map((size: number) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <div className="order-1 flex flex-col items-center justify-center gap-2.5 pt-2.5 sm:order-2 sm:flex-row sm:justify-end sm:pt-0">
        {isLoading ? (
          mergedProps?.infoSkeleton
        ) : (
          <>
            <div className="text-muted-foreground text-sm order-2 text-nowrap sm:order-1">
              {paginationInfo}
            </div>
            {pageCount > 1 && (
              <div className="order-1 flex items-center space-x-1 rtl:space-x-reverse sm:order-2">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={btnArrowClasses}
                  onClick={handlePreviousPage}
                  disabled={!table.getCanPreviousPage()}>
                  <span className="sr-only">{mergedProps.previousPageLabel}</span>
                  <ChevronLeftIcon className="size-4" />
                </Button>

                {renderEllipsisPrevButton()}

                {renderPageButtons()}

                {renderEllipsisNextButton()}

                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={btnArrowClasses}
                  onClick={handleNextPage}
                  disabled={!table.getCanNextPage()}>
                  <span className="sr-only">{mergedProps.nextPageLabel}</span>
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { DataGridPagination, type DataGridPaginationProps };
