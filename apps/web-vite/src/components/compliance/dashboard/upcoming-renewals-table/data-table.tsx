
import { useMemo, useState } from 'react';
import { WorkbenchDataTable } from '../../../table-kit/workbench-data-table.js';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import type { UpcomingRow } from '../hooks/use-compliance-dashboard.js';
import { getUpcomingRenewalsColumns } from './columns.js';

export interface UpcomingRenewalsTableProps {
  rows: UpcomingRow[];
  totalRows: number;
  isRefetching?: boolean;
  sectionClassName?: string;
}

export function UpcomingRenewalsTable({
  rows,
  totalRows,
  isRefetching,
  sectionClassName,
}: UpcomingRenewalsTableProps) {
  const t = useTranslations('Compliance.dashboard');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo(() => getUpcomingRenewalsColumns(t), [t]);

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
      entityLabel={t('upcomingRenewals.entityLabel')}
      emptyTitle={t('upcomingRenewals.empty')}
      noResultsTitle={t('upcomingRenewals.empty')}
    />
  );
}
