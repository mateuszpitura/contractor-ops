import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { AuditLogEntry } from '../audit-log-table.js';

export const AUDIT_LOG_PAGE_SIZE = 25;
const AUDIT_LOG_PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEBOUNCE_MS = 300;

/** Format a local Date to `YYYY-MM-DD` without UTC shift. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` as local midnight (not UTC). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function useAuditLogTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.auditLog');
  const tAria = useTranslations('Common.aria');
  const tEmpty = useTranslations('EmptyStates.auditLog');
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const [search, setSearch] = useQueryState('auditSearch', parseAsString.withDefault(''));
  const [actorId, setActorId] = useQueryState('actorId', parseAsString.withDefault(''));
  const [actions, setActions] = useQueryState(
    'auditActions',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [resourceTypes, setResourceTypes] = useQueryState(
    'auditResourceTypes',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [dateFrom, setDateFrom] = useQueryState('dateFrom', parseAsString.withDefault(''));
  const [dateTo, setDateTo] = useQueryState('dateTo', parseAsString.withDefault(''));
  const [auditPage, setAuditPage] = useQueryState('auditPage', parseAsString.withDefault('1'));
  const [auditPageSize, setAuditPageSize] = useQueryState(
    'auditPageSize',
    parseAsString.withDefault(String(AUDIT_LOG_PAGE_SIZE)),
  );
  const [auditSort, setAuditSort] = useQueryState('auditSort', parseAsString.withDefault('desc'));

  const dateRangeValue = useMemo<DateRange | undefined>(() => {
    if (!(dateFrom || dateTo)) return;
    return {
      from: dateFrom ? parseLocalDate(dateFrom) : undefined,
      to: dateTo ? parseLocalDate(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      void setSearch(localSearch || null);
      void setAuditPage('1');
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch, setSearch, setAuditPage]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const currentPage = Math.max(1, parseInt(auditPage, 10) || 1);
  const parsedPageSize = parseInt(auditPageSize, 10);
  const currentPageSize = AUDIT_LOG_PAGE_SIZE_OPTIONS.includes(parsedPageSize)
    ? parsedPageSize
    : AUDIT_LOG_PAGE_SIZE;
  const apiAction = actions.length === 1 ? actions[0] : undefined;
  const apiResourceType = resourceTypes.length === 1 ? resourceTypes[0] : undefined;

  const queryInput = useMemo(
    () => ({
      page: currentPage,
      pageSize: currentPageSize,
      search: search || undefined,
      actorId: actorId || undefined,
      action: apiAction,
      resourceType: apiResourceType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortOrder: (auditSort as 'asc' | 'desc') || 'desc',
    }),
    [
      currentPage,
      currentPageSize,
      search,
      actorId,
      apiAction,
      apiResourceType,
      dateFrom,
      dateTo,
      auditSort,
    ],
  );

  const listQuery = useQuery({
    ...trpc.audit.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });
  const actorsQuery = useQuery(trpc.audit.actors.queryOptions());

  const exportMutation = useMutation(
    trpc.audit.export.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(toasts.done());
        queryClient.invalidateQueries(trpc.audit.pathFilter());
      },
    }),
  );

  const items = (listQuery.data?.items ?? []) as unknown as AuditLogEntry[];
  const totalCount = (listQuery.data?.total as number) ?? 0;

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const handleToggleRow = useCallback((id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      void setAuditPage(String(page));
    },
    [setAuditPage],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      void setAuditPageSize(String(size));
      void setAuditPage('1');
    },
    [setAuditPageSize, setAuditPage],
  );

  const handleSortOrderChange = useCallback(
    (order: 'asc' | 'desc') => {
      void setAuditSort(order);
    },
    [setAuditSort],
  );

  const handleExport = useCallback(() => {
    exportMutation.mutate(
      {
        search: search || undefined,
        actorId: actorId || undefined,
        action: apiAction,
        resourceType: apiResourceType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
      {
        onSuccess: result => {
          const raw = atob(result.data);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: result.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success(t('exportToast', { count: totalCount }));
        },
      },
    );
  }, [
    exportMutation,
    search,
    actorId,
    apiAction,
    apiResourceType,
    dateFrom,
    dateTo,
    totalCount,
    t,
  ]);

  const actorOptions = useMemo(() => {
    const actors = actorsQuery.data ?? [];
    return actors.map(a => ({ id: a.id, name: a.name }));
  }, [actorsQuery.data]);

  const [actorOpen, setActorOpen] = useState(false);
  const [actorQuery, setActorQuery] = useState('');
  const MAX_VISIBLE_ACTORS = 10;

  const selectedActorLabel = useMemo(() => {
    if (!actorId) return null;
    return actorOptions.find(a => a.id === actorId)?.name ?? actorId;
  }, [actorId, actorOptions]);

  const filteredActorOptions = useMemo(() => {
    const q = actorQuery.trim().toLowerCase();
    if (!q) return actorOptions;
    return actorOptions.filter(a => a.name.toLowerCase().includes(q));
  }, [actorOptions, actorQuery]);

  const visibleActorOptions = useMemo(() => {
    if (actorQuery.trim()) return filteredActorOptions;
    const selected = actorId ? filteredActorOptions.filter(a => a.id === actorId) : [];
    const rest = filteredActorOptions.filter(a => a.id !== actorId).slice(0, MAX_VISIBLE_ACTORS);
    return [...selected, ...rest];
  }, [filteredActorOptions, actorId, actorQuery]);

  const toggleAction = useCallback(
    (value: string) => {
      void setActions(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
      );
      void setAuditPage('1');
    },
    [setActions, setAuditPage],
  );

  const toggleResourceType = useCallback(
    (value: string) => {
      void setResourceTypes(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
      );
      void setAuditPage('1');
    },
    [setResourceTypes, setAuditPage],
  );

  const removeAction = useCallback(
    (value: string) => {
      void setActions(prev => prev.filter(v => v !== value));
      void setAuditPage('1');
    },
    [setActions, setAuditPage],
  );

  const removeResourceType = useCallback(
    (value: string) => {
      void setResourceTypes(prev => prev.filter(v => v !== value));
      void setAuditPage('1');
    },
    [setResourceTypes, setAuditPage],
  );

  const clearAllFilters = useCallback(() => {
    void setActions([]);
    void setResourceTypes([]);
    void setActorId(null);
    void setDateFrom(null);
    void setDateTo(null);
    void setAuditPage('1');
  }, [setActions, setResourceTypes, setActorId, setDateFrom, setDateTo, setAuditPage]);

  const handleDateRangeSelect = useCallback(
    (range: DateRange | undefined, triggerDate: Date) => {
      if (!range) {
        void setDateFrom(null);
        void setDateTo(null);
        void setAuditPage('1');
        return;
      }

      const currentFrom = dateFrom ? parseLocalDate(dateFrom) : undefined;
      const currentTo = dateTo ? parseLocalDate(dateTo) : undefined;

      if (currentFrom && currentTo && range.from && !range.to) {
        const clicked = triggerDate.getTime();
        const fromTime = currentFrom.getTime();
        const toTime = currentTo.getTime();

        if (clicked <= fromTime) {
          void setDateFrom(toLocalDateString(triggerDate));
        } else if (clicked >= toTime) {
          void setDateTo(toLocalDateString(triggerDate));
        } else {
          const distToFrom = clicked - fromTime;
          const distToTo = toTime - clicked;
          if (distToFrom <= distToTo) {
            void setDateFrom(toLocalDateString(triggerDate));
          } else {
            void setDateTo(toLocalDateString(triggerDate));
          }
        }
        void setAuditPage('1');
        return;
      }

      void setDateFrom(range.from ? toLocalDateString(range.from) : null);
      void setDateTo(range.to ? toLocalDateString(range.to) : null);
      void setAuditPage('1');
    },
    [dateFrom, dateTo, setDateFrom, setDateTo, setAuditPage],
  );

  const clearDates = useCallback(() => {
    void setDateFrom(null);
    void setDateTo(null);
    void setAuditPage('1');
  }, [setDateFrom, setDateTo, setAuditPage]);

  const selectActor = useCallback(
    (id: string) => {
      void setActorId(id);
      void setAuditPage('1');
      setActorQuery('');
      setActorOpen(false);
    },
    [setActorId, setAuditPage],
  );

  const clearActor = useCallback(() => {
    void setActorId(null);
    void setAuditPage('1');
  }, [setActorId, setAuditPage]);

  const activeFilterCount =
    actions.length + resourceTypes.length + (actorId ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  const isLoading = listQuery.isPending && !listQuery.data;
  const isRefetching = listQuery.isFetching && !isLoading;
  const hasAnyFilter = activeFilterCount > 0 || (typeof search === 'string' && search.length > 0);
  const isTrulyEmpty = !isLoading && items.length === 0 && !hasAnyFilter;

  return {
    t,
    tAria,
    tEmpty,
    localSearch,
    setLocalSearch,
    actorId,
    actions,
    resourceTypes,
    dateFrom,
    dateTo,
    auditSort,
    dateRangeValue,
    currentPage,
    currentPageSize,
    items,
    totalCount,
    expandedRows,
    handleToggleRow,
    handlePageChange,
    handlePageSizeChange,
    handleSortOrderChange,
    handleExport,
    exportMutation,
    actorOpen,
    setActorOpen,
    actorQuery,
    setActorQuery,
    actorOptions,
    selectedActorLabel,
    visibleActorOptions,
    MAX_VISIBLE_ACTORS,
    toggleAction,
    toggleResourceType,
    removeAction,
    removeResourceType,
    clearAllFilters,
    handleDateRangeSelect,
    clearDates,
    selectActor,
    clearActor,
    activeFilterCount,
    isLoading,
    isRefetching,
    isTrulyEmpty,
  } as const;
}
