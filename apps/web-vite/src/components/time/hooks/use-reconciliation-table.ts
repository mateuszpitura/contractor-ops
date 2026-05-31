import { useCallback, useMemo, useState } from 'react';

import { cursorPaginationTotalRows } from '../../shared/cursor-pagination.js';
import { useReconciliationList } from './use-reconciliation.js';

const DEFAULT_PAGE_SIZE = 10;

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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors[cursors.length - 1];

  const query = useReconciliationList({ cursor: currentCursor, limit: pageSize });

  const items = useMemo(() => (query.data?.items ?? []) as ReconciliationItem[], [query.data]);

  const nextCursor = query.data?.nextCursor;
  const hasNextPage = Boolean(nextCursor);
  const currentPage = cursors.length + 1;

  const totalCount = useMemo(
    () => cursorPaginationTotalRows(cursors.length, pageSize, items.length, hasNextPage),
    [cursors.length, pageSize, items.length, hasNextPage],
  );

  const onRetry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const onPageChange = useCallback(
    (page: number) => {
      if (page < currentPage) {
        setCursors(prev => prev.slice(0, page - 1));
        return;
      }
      if (page > currentPage && nextCursor) {
        setCursors(prev => [...prev, nextCursor]);
      }
    },
    [currentPage, nextCursor],
  );

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCursors([]);
  }, []);

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
    items,
    totalCount,
    pageSize,
    currentPage,
    onPageChange,
    onPageSizeChange,
    isFetching: query.isFetching,
  } as const;
}

export type UseReconciliationTableReturn = ReturnType<typeof useReconciliationTable>;
