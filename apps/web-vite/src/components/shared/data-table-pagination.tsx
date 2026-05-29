import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface DataTablePaginationProps<TData> {
  /** Optional TanStack table — when present, drives the selected-row count label. */
  table?: Table<TData>;
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
  /**
   * Optional selected-count translator. When provided AND `table` is provided,
   * the selected-row count appears on the left side.
   */
  selectedCountLabel?: (count: number) => string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Canonical pagination row used at the bottom of every workbench data table.
 *
 * Anatomy (left → right):
 *   [selected-count]                        [rows-per-page Select] [page-of] [Prev] [Next]
 *
 * Total row count is intentionally NOT rendered here — it lives in the
 * `TableChrome` count strip at the top-left of the table, so repeating it
 * in the footer reads as visual noise.
 */
export function DataTablePagination<TData>({
  table,
  totalRows,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  rowsPerPageLabel,
  pageOfLabel,
  selectedCountLabel,
}: DataTablePaginationProps<TData>) {
  const tCommon = useTranslations('Common');
  const tAria = useTranslations('Common.aria');

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const selectedCount = table?.getFilteredSelectedRowModel().rows.length ?? 0;
  const showSelectedChip = selectedCount > 0 && typeof selectedCountLabel === 'function';
  const rowsPerPage = rowsPerPageLabel ?? tCommon('pagination.rowsPerPage');
  const pageIndicator =
    pageOfLabel ?? tCommon('pagination.page', { page: currentPage, pageCount: totalPages });

  return (
    <div className="flex w-full items-center gap-6 px-4 py-3">
      {showSelectedChip && (
        <span className="text-sm text-muted-foreground">{selectedCountLabel(selectedCount)}</span>
      )}

      <div className="ms-auto flex items-center gap-4">
        {typeof onPageSizeChange === 'function' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{rowsPerPage}</span>
            <Select
              value={String(pageSize)}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onValueChange={value => onPageSizeChange(Number(value))}>
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
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onPageChange(currentPage - 1)}
            aria-label={tAria('previousPage')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onPageChange(currentPage + 1)}
            aria-label={tAria('nextPage')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
