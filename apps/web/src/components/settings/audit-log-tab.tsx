'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Download, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Format a local Date to `YYYY-MM-DD` without UTC shift. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` as local midnight (not UTC). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';
import type { AuditLogEntry } from './audit-log-table';
import { AuditLogTable } from './audit-log-table';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 300;

const ACTION_OPTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'SUBMIT',
  'EXPORT',
  'INVITE',
  'DEACTIVATE',
  'LOGIN',
] as const;

const RESOURCE_TYPE_OPTIONS = [
  'ORGANIZATION',
  'CONTRACTOR',
  'CONTRACT',
  'DOCUMENT',
  'INVOICE',
  'WORKFLOW_RUN',
  'WORKFLOW_TASK_RUN',
  'PAYMENT_RUN',
  'PROJECT',
  'TEAM',
  'APPROVAL_FLOW',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Audit log tab for the Settings page.
 * Full-text search, structured filters (actor, action, resource type, date range),
 * expandable table with diff viewer, and CSV export.
 * All filter state synced to URL via nuqs for deep-linking.
 */
export function AuditLogTab() {
  const t = useTranslations('Settings.auditLog');
  const tAria = useTranslations('Common.aria');

  // ---------------------------------------------------------------------------
  // URL state (nuqs)
  // ---------------------------------------------------------------------------

  const [search, setSearch] = useQueryState('auditSearch', parseAsString.withDefault(''));
  const [actorId, setActorId] = useQueryState('actorId', parseAsString.withDefault(''));
  const [actionFilter, setActionFilter] = useQueryState(
    'actionFilter',
    parseAsString.withDefault(''),
  );
  const [resourceType, setResourceType] = useQueryState(
    'resourceType',
    parseAsString.withDefault(''),
  );
  const [dateFrom, setDateFrom] = useQueryState('dateFrom', parseAsString.withDefault(''));
  const [dateTo, setDateTo] = useQueryState('dateTo', parseAsString.withDefault(''));
  const [auditPage, setAuditPage] = useQueryState('auditPage', parseAsString.withDefault('1'));
  const [auditSort, setAuditSort] = useQueryState('auditSort', parseAsString.withDefault('desc'));

  // ---------------------------------------------------------------------------
  // Debounced search
  // ---------------------------------------------------------------------------

  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      void setSearch(localSearch || null);
      void setAuditPage('1');
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch, setSearch, setAuditPage]);

  // Sync URL -> local on external change
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const currentPage = Math.max(1, parseInt(auditPage, 10) || 1);

  const queryInput = useMemo(
    () => ({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      actorId: actorId || undefined,
      action: actionFilter || undefined,
      resourceType: resourceType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortOrder: (auditSort as 'asc' | 'desc') || 'desc',
    }),
    [currentPage, search, actorId, actionFilter, resourceType, dateFrom, dateTo, auditSort],
  );

  const listQuery = useQuery({
    ...trpc.audit.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });
  const actorsQuery = useQuery(trpc.audit.actors.queryOptions());
  const queryClient = useQueryClient();
  const exportMutation = useMutation(
    trpc.audit.export.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.audit.pathFilter());
      },
    }),
  );

  const items = (listQuery.data?.items ?? []) as unknown as AuditLogEntry[];
  const totalCount = (listQuery.data?.totalCount as number) ?? 0;

  // ---------------------------------------------------------------------------
  // Expanded rows
  // ---------------------------------------------------------------------------

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const handleToggleRow = useCallback((id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Page change
  // ---------------------------------------------------------------------------

  const handlePageChange = useCallback(
    (page: number) => {
      void setAuditPage(String(page));
    },
    [setAuditPage],
  );

  // ---------------------------------------------------------------------------
  // Sort change
  // ---------------------------------------------------------------------------

  const handleSortOrderChange = useCallback(
    (order: 'asc' | 'desc') => {
      void setAuditSort(order);
    },
    [setAuditSort],
  );

  // ---------------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------------

  const handleExport = useCallback(() => {
    exportMutation.mutate(
      {
        search: search || undefined,
        actorId: actorId || undefined,
        action: actionFilter || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
      {
        onSuccess: result => {
          // base64 -> Blob -> download
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
    actionFilter,
    resourceType,
    dateFrom,
    dateTo,
    totalCount,
    t,
  ]);

  // ---------------------------------------------------------------------------
  // Actors for dropdown
  // ---------------------------------------------------------------------------

  const actorOptions = useMemo(() => {
    const actors = actorsQuery.data ?? [];
    return actors.map(a => ({ id: a.id, name: a.name }));
  }, [actorsQuery.data]);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  const isLoading = listQuery.isPending && !listQuery.data;
  const isRefetching = listQuery.isFetching && !isLoading;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Search + Export */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localSearch}
            disabled={isLoading}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setLocalSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="ps-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isLoading || exportMutation.isPending || totalCount === 0}>
          {exportMutation.isPending ? (
            <Loader2 className="me-2 size-4 animate-spin" />
          ) : (
            <Download className="me-2 size-4" />
          )}
          {t('exportCta')}
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Actor filter */}
        <Select
          disabled={isLoading}
          value={actorId}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={val => {
            void setActorId(val || null);
            void setAuditPage('1');
          }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('filterActorAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filterActorAll')}</SelectItem>
            {actorOptions.map(actor => (
              <SelectItem key={actor.id} value={actor.id}>
                {actor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action filter */}
        <Select
          disabled={isLoading}
          value={actionFilter}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={val => {
            void setActionFilter(val || null);
            void setAuditPage('1');
          }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('filterActionAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filterActionAll')}</SelectItem>
            {ACTION_OPTIONS.map(action => (
              <SelectItem key={action} value={action}>
                {t(`actions.${enumKey(action)}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Resource type filter */}
        <Select
          disabled={isLoading}
          value={resourceType}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={val => {
            void setResourceType(val || null);
            void setAuditPage('1');
          }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('filterResourceAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filterResourceAll')}</SelectItem>
            {RESOURCE_TYPE_OPTIONS.map(rt => (
              <SelectItem key={rt} value={rt}>
                {t(`resources.${enumKey(rt)}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="default" className="gap-1.5" disabled={isLoading} />
            }>
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="text-xs">
              {dateFrom && dateTo
                ? `${dateFrom} – ${dateTo}`
                : dateFrom
                  ? t('dateFromPrefix', { date: dateFrom })
                  : dateTo
                    ? t('dateToPrefix', { date: dateTo })
                    : t('filterDateRange')}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">
                  {tAria('dateFrom')}
                </p>
                <Calendar
                  mode="single"
                  selected={dateFrom ? parseLocalDate(dateFrom) : undefined}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onSelect={date => {
                    void setDateFrom(date ? toLocalDateString(date) : null);
                    void setAuditPage('1');
                  }}
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">{tAria('dateTo')}</p>
                <Calendar
                  mode="single"
                  selected={dateTo ? parseLocalDate(dateTo) : undefined}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onSelect={date => {
                    void setDateTo(date ? toLocalDateString(date) : null);
                    void setAuditPage('1');
                  }}
                />
              </div>
            </div>
            {!!(dateFrom || dateTo) && (
              <div className="border-t px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => {
                    void setDateFrom(null);
                    void setDateTo(null);
                    void setAuditPage('1');
                  }}>
                  {t('clearDates')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <AuditLogTable
        data={items}
        totalCount={totalCount}
        page={currentPage}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        sortOrder={(auditSort as 'asc' | 'desc') || 'desc'}
        onSortOrderChange={handleSortOrderChange}
        expandedRows={expandedRows}
        onToggleRow={handleToggleRow}
        isLoading={isLoading}
        isFetching={isRefetching}
      />
    </div>
  );
}
