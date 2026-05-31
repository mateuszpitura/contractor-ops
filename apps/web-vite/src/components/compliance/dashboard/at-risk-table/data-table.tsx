import { DataTable } from '@contractor-ops/ui';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import type { AtRiskRow } from '../hooks/use-compliance-dashboard.js';
import { getAtRiskColumns } from './columns.js';

export interface AtRiskTableProps {
  rows: AtRiskRow[];
  totalRows: number;
  isRefetching?: boolean;
  /**
   * Slot for Plan 73-08 to cross-mount `<OverrideComplianceItemButton/>` per row.
   * Left undefined here; this plan does NOT build the override modal.
   */
  renderRowActions?: (row: AtRiskRow) => ReactNode;
}

export function AtRiskTable({ rows, totalRows, isRefetching, renderRowActions }: AtRiskTableProps) {
  const t = useTranslations('Compliance.dashboard');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo(() => {
    const base = getAtRiskColumns(t);
    if (!renderRowActions) return base;
    return [
      ...base,
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => renderRowActions(row.original),
      },
    ];
  }, [t, renderRowActions]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      totalRows={totalRows}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={setPageSize}
      isRefetching={isRefetching}
      entityLabel={t('atRisk.entityLabel')}
      emptyTitle={t('atRisk.empty')}
      noResultsTitle={t('atRisk.empty')}
    />
  );
}
