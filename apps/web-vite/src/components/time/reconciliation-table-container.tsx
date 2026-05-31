import { QueryErrorPanel } from '@contractor-ops/ui';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useReconciliationTable } from './hooks/use-reconciliation-table.js';
import { ReconciliationDataTable } from './reconciliation/data-table.js';

export function ReconciliationTable() {
  const table = useReconciliationTable();
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');

  if (table.isError) {
    return (
      <QueryErrorPanel
        message={tCommon('networkError')}
        retryLabel={tProfile('error.retry')}
        onRetry={table.onRetry}
      />
    );
  }

  return (
    <ReconciliationDataTable
      items={table.items}
      totalCount={table.totalCount}
      pageSize={table.pageSize}
      currentPage={table.currentPage}
      onPageChange={table.onPageChange}
      onPageSizeChange={table.onPageSizeChange}
      isLoading={table.isLoading}
      isFetching={table.isFetching}
    />
  );
}
