"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  totalRows: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Pagination controls for the workflow runs data table.
 * Includes page size selector, page navigation, and selection count.
 */
export function DataTablePagination<TData>({
  table,
  totalRows,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations("Workflows.pagination");

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {selectedCount > 0 && (
          <span>{t("selected", { count: selectedCount })}</span>
        )}
        <span>{t("of", { total: totalRows })}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("rowsPerPage")}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page indicator */}
        <span className="text-sm text-muted-foreground">
          {t("page", { page: currentPage, totalPages })}
        </span>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
