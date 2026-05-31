import { DataTable } from '@contractor-ops/ui';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import type { BlockedRow } from '../hooks/use-compliance-dashboard.js';
import { getBlockedPaymentsColumns } from './columns.js';

export interface BlockedPaymentsTableProps {
  rows: BlockedRow[];
  totalRows: number;
  isRefetching?: boolean;
  /** Slot for Plan 73-08 to cross-mount per-row override actions; unused here. */
  renderRowActions?: (row: BlockedRow) => ReactNode;
}

export function BlockedPaymentsTable({
  rows,
  totalRows,
  isRefetching,
  renderRowActions,
}: BlockedPaymentsTableProps) {
  const t = useTranslations('Compliance.dashboard');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo(() => {
    const base = getBlockedPaymentsColumns(t);
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
      getRowId={row => row.contractorId}
      entityLabel={t('blockedPayments.entityLabel')}
      emptyTitle={t('blockedPayments.empty')}
      noResultsTitle={t('blockedPayments.empty')}
    />
  );
}
