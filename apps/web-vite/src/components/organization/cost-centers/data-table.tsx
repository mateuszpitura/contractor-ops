import { TeamsIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { StatusBadge } from '../shared/status-badge.js';
import type { CostCenterRow } from './cost-center-form-sheet.js';

export interface CostCenterTableRow extends CostCenterRow {
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  updatedAt: Date | string;
}

interface CostCenterTableProps {
  rows: CostCenterTableRow[];
  onRowClick?: (row: CostCenterTableRow) => void;
  onNewCostCenter?: () => void;
  onClearSearch?: () => void;
  hasSearch?: boolean;
  isLoading?: boolean;
}

export function CostCenterTable({
  rows,
  onRowClick,
  onNewCostCenter,
  onClearSearch,
  hasSearch = false,
  isLoading,
}: CostCenterTableProps) {
  const t = useTranslations('Organization');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const columns = useMemo<ColumnDef<CostCenterTableRow, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('colName'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'code',
        accessorKey: 'code',
        header: t('colCode'),
        cell: ({ row }) => <span className="font-mono uppercase">{row.original.code}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('colStatus'),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'updated',
        accessorFn: row => new Date(row.updatedAt).getTime(),
        header: t('colUpdated'),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {format(new Date(row.original.updatedAt), 'yyyy-MM-dd')}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkbenchDataTable
        columns={columns}
        data={rows}
        totalRows={rows.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        entityLabel={t('entityCostCenters', { count: rows.length })}
        isLoading={isLoading}
        hasFiltersOrSearch={hasSearch}
        onClearFilters={onClearSearch}
        clearFiltersLabel={t('clearSearchChip')}
        onRowClick={onRowClick}
        emptyIllustration={TeamsIllustration}
        emptyTitle={t('costCentersEmptyTitle')}
        emptyDescription={t('costCentersEmptyBody')}
        emptyCta={onNewCostCenter ? t('costCentersEmptyCta') : undefined}
        onEmptyCta={onNewCostCenter}
        emptyCtaIcon={Plus}
        noResultsTitle={t('noResultsTitle')}
        noResultsDescription={t('noResultsBody')}
        noResultsCta={t('noResultsCta')}
      />
    </div>
  );
}
