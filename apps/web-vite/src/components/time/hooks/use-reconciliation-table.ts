import { useCallback, useMemo } from 'react';

import { useReconciliationList } from './use-reconciliation.js';

interface ReconciliationItem {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string | Date;
    totalMinor: number;
    currency: string;
    servicePeriodStart: string | Date | null;
    servicePeriodEnd: string | Date | null;
  };
  contractor: {
    id: string;
    legalName: string;
  } | null;
  reconciliation: {
    approvedMinutes: number;
    rateValueMinor: number;
    rateType: string;
    hoursPerDay: number;
    expectedAmountMinor: number;
    invoicedAmountMinor: number;
    deviationMinor: number;
    deviationPercent: number;
    withinThreshold: boolean;
    thresholdPercent: number;
  };
}

export function useReconciliationTable() {
  const query = useReconciliationList();

  const items = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.flatMap(page => (page.items ?? []) as ReconciliationItem[]);
  }, [query.data]);

  const totalCount = useMemo(() => {
    const lastPage = query.data?.pages.at(-1) as
      | { items: ReconciliationItem[]; nextCursor?: string; total?: number }
      | undefined;
    if (typeof lastPage?.total === 'number') return lastPage.total;
    return items.length;
  }, [query.data, items.length]);

  const onRetry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const onLoadMore = useCallback(() => {
    void query.fetchNextPage();
  }, [query]);

  const isLoading = query.isLoading;
  const isError = query.isError;
  const isEmpty = !(isLoading || isError) && items.length === 0;
  const showData = !(isLoading || isError) && items.length > 0;

  return {
    isLoading,
    isError,
    isEmpty,
    showData,
    onRetry,
    onLoadMore,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: Boolean(query.isFetchingNextPage),
    items,
    totalCount,
  } as const;
}

export type UseReconciliationTableReturn = ReturnType<typeof useReconciliationTable>;
