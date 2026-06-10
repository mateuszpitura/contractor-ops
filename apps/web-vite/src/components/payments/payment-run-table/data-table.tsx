
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { PaymentRunRow } from './columns.js';

interface PaymentRunDataTableProps {
  data: PaymentRunRow[];
  columns: ColumnDef<PaymentRunRow>[];
  isLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRowClick: (run: PaymentRunRow) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  activeFilterCount?: number;
  sectionClassName?: string;
}

const noopPageChange = () => undefined;
const getRowId = (row: PaymentRunRow) => row.id;

export function PaymentRunDataTable({
  data,
  columns,
  isLoading,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onRowClick,
  hasActiveFilters,
  onClearFilters,
  activeFilterCount = 0,
  sectionClassName,
}: PaymentRunDataTableProps) {
  const t = useTranslations('Payments');

  const handleRowClick = useCallback((row: PaymentRunRow) => onRowClick(row), [onRowClick]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <WorkbenchDataTable
        sectionClassName={sectionClassName}
        columns={columns}
        data={data}
        totalRows={data.length}
        pageIndex={0}
        pageSize={data.length || 1}
        onPageChange={noopPageChange}
        onPageSizeChange={noopPageChange}
        isLoading={isLoading}
        hideFooter
        fill
        entityLabel={t('entityLabel', { count: data.length })}
        hasFiltersOrSearch={Boolean(hasActiveFilters)}
        onClearFilters={onClearFilters}
        clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
        onRowClick={handleRowClick}
        getRowId={getRowId}
        emptyTitle={t('emptyHeading')}
        emptyDescription={t('emptyBody')}
        noResultsTitle={t('emptyHeading')}
        noResultsDescription={t('emptyBody')}
        skeletonRows={8}
      />

      {!isLoading && (hasPreviousPage || hasNextPage) ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onPreviousPage} disabled={!hasPreviousPage}>
            <ChevronLeft className="h-4 w-4" />
            {t('table.previous')}
          </Button>
          <Button variant="outline" size="sm" onClick={onNextPage} disabled={!hasNextPage}>
            {t('table.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
