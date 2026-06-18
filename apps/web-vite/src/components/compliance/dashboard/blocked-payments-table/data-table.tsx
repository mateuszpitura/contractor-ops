import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../../table-kit/workbench-data-table.js';
import type { BlockedRow } from '../hooks/use-compliance-dashboard.js';
import { getBlockedPaymentsColumns } from './columns.js';

const getBlockedRowId = (row: BlockedRow) => row.contractorId;

export interface BlockedPaymentsTableProps {
  rows: BlockedRow[];
  totalRows: number;
  isRefetching?: boolean;
  /** Optional slot to cross-mount per-row override actions; unused by default. */
  renderRowActions?: (row: BlockedRow) => ReactNode;
  sectionClassName?: string;
}

export function BlockedPaymentsTable({
  rows,
  totalRows,
  isRefetching,
  renderRowActions,
  sectionClassName,
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
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={rows}
      totalRows={totalRows}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={setPageSize}
      isRefetching={isRefetching}
      getRowId={getBlockedRowId}
      entityLabel={t('blockedPayments.entityLabel')}
      emptyTitle={t('blockedPayments.empty')}
      noResultsTitle={t('blockedPayments.empty')}
    />
  );
}
