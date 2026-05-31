import { useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { PaymentRunRow } from '../payment-run-table/columns.js';
import { getColumns } from '../payment-run-table/columns.js';

export function usePaymentsList(options: { onOpenSidePanel: (runId: string) => void }) {
  const t = useTranslations('Payments');
  const trpc = useTRPC();
  const { formatDate, formatDateTime } = useDateFormatter();

  const [statuses, setStatuses] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors[cursors.length - 1] ?? undefined;

  const apiStatus:
    | 'DRAFT'
    | 'LOCKED'
    | 'EXPORTED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | undefined =
    statuses.length === 1
      ? (statuses[0] as 'DRAFT' | 'LOCKED' | 'EXPORTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED')
      : undefined;

  const queryInput = useMemo(
    () => ({
      status: apiStatus,
      cursor: currentCursor,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
    }),
    [apiStatus, currentCursor, dateFrom, dateTo],
  );

  const runsQuery = useQuery(trpc.payment.list.queryOptions(queryInput));

  const data = useMemo(() => {
    const result = runsQuery.data;
    const items = (result?.items ?? []) as unknown as PaymentRunRow[];
    if (statuses.length <= 1) return items;
    const filterSet = new Set(statuses);
    return items.filter(row => filterSet.has(row.status));
  }, [runsQuery.data, statuses]);

  const nextCursor = useMemo(() => {
    const result = runsQuery.data;
    return result?.nextCursor as string | undefined;
  }, [runsQuery.data]);

  const activityDatesQuery = useQuery(trpc.payment.activityDates.queryOptions());
  const activityDates = useMemo(() => {
    const raw = activityDatesQuery.data as string[] | undefined;
    if (!raw?.length) return [];
    return raw.map(iso => {
      const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
      return new Date(y, m - 1, d);
    });
  }, [activityDatesQuery.data]);

  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;

  const handleStatusChange = useCallback(
    (newStatuses: string[]) => {
      void setStatuses(newStatuses);
      setCursors([]);
    },
    [setStatuses],
  );

  const handleDateFromChange = useCallback((date: Date | undefined) => {
    setDateFrom(date);
    setCursors([]);
  }, []);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    setDateTo(date);
    setCursors([]);
  }, []);

  const handleNextPage = useCallback(() => {
    if (nextCursor) {
      setCursors(prev => [...prev, nextCursor]);
    }
  }, [nextCursor]);

  const handlePreviousPage = useCallback(() => {
    setCursors(prev => prev.slice(0, -1));
  }, []);

  const handleRowClick = useCallback(
    (run: PaymentRunRow) => {
      options.onOpenSidePanel(run.id);
    },
    [options],
  );

  const handleClearFilters = useCallback(() => {
    void setStatuses([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setCursors([]);
  }, [setStatuses]);

  const columns = useMemo(
    () =>
      getColumns(
        t,
        {
          onDownloadExport: () => {
            // Download is handled from the side panel in this view.
          },
          onMarkAllPaid: run => options.onOpenSidePanel(run.id),
          onCancelRun: run => options.onOpenSidePanel(run.id),
        },
        formatDate,
        formatDateTime,
      ),
    [t, formatDate, formatDateTime, options],
  );

  const isLoading = runsQuery.isLoading;
  const isFetching = runsQuery.isFetching;
  const hasActiveFilters = statuses.length > 0 || !!dateFrom || !!dateTo;
  const showEmptyState =
    !(isLoading || isFetching) && data.length === 0 && !hasActiveFilters && cursors.length === 0;

  return {
    showEmptyState,
    contractorCount,
    isLoading,
    isFetching,
    hasActiveFilters,
    toolbarProps: {
      activeStatuses: statuses,
      onStatusChange: handleStatusChange,
      dateFrom,
      dateTo,
      onDateFromChange: handleDateFromChange,
      onDateToChange: handleDateToChange,
      activityDates,
      isLoading,
    },
    tableProps: {
      data,
      columns,
      isLoading,
      hasNextPage: !!nextCursor,
      hasPreviousPage: cursors.length > 0,
      onNextPage: handleNextPage,
      onPreviousPage: handlePreviousPage,
      onRowClick: handleRowClick,
      hasActiveFilters,
      activeFilterCount: (statuses.length > 0 ? 1 : 0) + (dateFrom || dateTo ? 1 : 0),
      onClearFilters: handleClearFilters,
    },
  } as const;
}
