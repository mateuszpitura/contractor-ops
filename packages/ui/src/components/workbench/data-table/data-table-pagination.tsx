import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

import { useUITranslations } from '../../../i18n/translations-provider.js';
import { Button } from '../../shadcn/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shadcn/select.js';
import { DEFAULT_PAGE_SIZE_OPTIONS } from './types.js';

interface DataTablePaginationProps {
  totalRows: number;
  pageSize: number;
  /** 1-based page number for display. */
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
}

/**
 * Canonical pagination footer. Right-aligned cluster:
 *   [rows-per-page Select] [Page X of Y] [Prev] [Next]
 *
 * Hides the page-size selector when `onPageSizeChange` is undefined. Disables
 * controls while the table is loading.
 */
export function DataTablePagination({
  totalRows,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  disabled = false,
}: DataTablePaginationProps) {
  const t = useUITranslations();
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const rowsPerPage = t('pagination.rowsPerPage');
  const pageIndicator = t('pagination.page', { page: currentPage, pageCount: totalPages });

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
        {typeof onPageSizeChange === 'function' ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{rowsPerPage}</span>
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
              disabled={disabled}>
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
        ) : null}

        <span className="text-sm text-muted-foreground">{pageIndicator}</span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={disabled || currentPage <= 1}
            onClick={handlePreviousPage}
            aria-label={t('aria.previousPage')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={disabled || currentPage >= totalPages}
            onClick={handleNextPage}
            aria-label={t('aria.nextPage')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
