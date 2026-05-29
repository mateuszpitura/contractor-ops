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

import { useTranslations } from '../../../i18n/useTranslations.js';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  totalRows: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function DataTablePagination<TData>({
  table,
  totalRows,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations('Invoices.pagination');
  const tAria = useTranslations('Common.aria');

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className="flex w-full items-center gap-6 px-4 py-3">
      {selectedCount > 0 && (
        <span className="text-sm text-muted-foreground">
          {t('selected', { count: selectedCount })}
        </span>
      )}

      <div className="ms-auto flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('rowsPerPage')}</span>
          <Select value={String(pageSize)} onValueChange={value => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[70px]" aria-label={t('rowsPerPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-sm text-muted-foreground">
          {t('page', { page: currentPage, totalPages })}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label={tAria('previousPage')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label={tAria('nextPage')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
