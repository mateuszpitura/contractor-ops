import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface DataTablePaginationProps {
  totalRows: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** Required for page-size selector. Pass undefined to hide the selector. */
  onPageSizeChange?: (size: number) => void;
  /** Override the page-size options. Defaults to [10, 25, 50]. */
  pageSizeOptions?: number[];
  /** Localized label for the "Rows per page" caption. Defaults to Common. */
  rowsPerPageLabel?: string;
  /** Localized "Page X of Y" formatter input. Defaults to Common.pagination.page. */
  pageOfLabel?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Canonical pagination row used at the bottom of every workbench data table.
 *
 * Anatomy (left → right):
 *   [rows-per-page Select] [page-of] [Prev] [Next]   (all right-aligned)
 *
 * Neither the total row count nor the selected-row count is rendered here —
 * the total lives in the `TableChrome` count strip at the top-left, and the
 * selected count lives in the bulk-action bar above the table. Repeating
 * either in the footer reads as visual noise.
 */
export function DataTablePagination({
  totalRows,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  rowsPerPageLabel,
  pageOfLabel,
}: DataTablePaginationProps) {
  const tCommon = useTranslations('Common');
  const tAria = useTranslations('Common.aria');

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const rowsPerPage = rowsPerPageLabel ?? tCommon('pagination.rowsPerPage');
  const pageIndicator =
    pageOfLabel ?? tCommon('pagination.page', { page: currentPage, pageCount: totalPages });

  const handlePageSizeChange = useCallback(
    (value: string | null) => {
      if (value !== null) onPageSizeChange?.(Number(value));
    },
    [onPageSizeChange],
  );
  const handlePreviousPage = useCallback(
    () => onPageChange(currentPage - 1),
    [onPageChange, currentPage],
  );
  const handleNextPage = useCallback(
    () => onPageChange(currentPage + 1),
    [onPageChange, currentPage],
  );

  return (
    <div className="flex w-full items-center gap-6 px-4 py-3">
      <div className="ms-auto flex items-center gap-4">
        {typeof onPageSizeChange === 'function' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{rowsPerPage}</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-[70px]" aria-label={rowsPerPage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <span className="text-sm text-muted-foreground">{pageIndicator}</span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={handlePreviousPage}
            aria-label={tAria('previousPage')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={handleNextPage}
            aria-label={tAria('nextPage')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
