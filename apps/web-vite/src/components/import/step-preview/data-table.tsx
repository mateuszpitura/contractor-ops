import { DataTable } from '@contractor-ops/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ImportRow } from '../import-wizard-dialog.js';

interface ImportPreviewDataTableProps {
  rows: ImportRow[];
  /** Used to resolve column key list — should include all rows, not just visible. */
  allRows: ImportRow[];
  errorCells: Set<string>;
  errorMessages: Map<string, string>;
}

export function ImportPreviewDataTable({
  rows,
  allRows,
  errorCells,
  errorMessages,
}: ImportPreviewDataTableProps) {
  const t = useTranslations('Import');

  const dataColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of allRows) {
      for (const key of Object.keys(row.data)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [allRows]);

  const columns = useMemo<ColumnDef<ImportRow, unknown>[]>(() => {
    const indexCol: ColumnDef<ImportRow, unknown> = {
      id: '_rowNumber',
      header: '#',
      enableSorting: false,
      size: 64,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.rowNumber}</span>
      ),
    };
    const dataCols: ColumnDef<ImportRow, unknown>[] = dataColumns.map(col => ({
      id: col,
      header: col,
      enableSorting: false,
      cell: ({ row }) => {
        const cellKey = `${row.original.rowNumber}:${col}`;
        const hasError = errorCells.has(cellKey);
        const errMsg = errorMessages.get(cellKey);
        return (
          <div
            className={
              hasError
                ? 'flex items-center gap-1 border-l-2 border-destructive pl-2'
                : 'flex items-center gap-1'
            }>
            <span className="block max-w-[160px] truncate text-sm">
              {String(row.original.data[col] ?? '')}
            </span>
            {!!hasError && !!errMsg && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{errMsg}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
    }));
    return [indexCol, ...dataCols];
  }, [dataColumns, errorCells, errorMessages]);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const rowClassName = useMemo(
    () => (row: ImportRow) => (row.status === 'invalid' ? 'bg-destructive/5' : ''),
    [],
  );

  return (
    <TooltipProvider>
      <DataTable
        columns={columns}
        data={rows}
        totalRows={rows.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        rowClassName={rowClassName}
        constrainHeight={false}
        hideDensityToggle
        entityLabel={t('confirm.contractors')}
        emptyTitle={t('preview.noRows')}
        noResultsTitle={t('preview.noRows')}
      />
    </TooltipProvider>
  );
}
