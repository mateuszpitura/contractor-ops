import { DataTable } from '@contractor-ops/ui';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import type { UpcomingRow } from '../hooks/use-compliance-dashboard.js';
import { getUpcomingRenewalsColumns } from './columns.js';

export interface UpcomingRenewalsTableProps {
  rows: UpcomingRow[];
  totalRows: number;
  isRefetching?: boolean;
}

export function UpcomingRenewalsTable({
  rows,
  totalRows,
  isRefetching,
}: UpcomingRenewalsTableProps) {
  const t = useTranslations('Compliance.dashboard');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo(() => getUpcomingRenewalsColumns(t), [t]);

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
      entityLabel={t('upcomingRenewals.entityLabel')}
      emptyTitle={t('upcomingRenewals.empty')}
      noResultsTitle={t('upcomingRenewals.empty')}
    />
  );
}
