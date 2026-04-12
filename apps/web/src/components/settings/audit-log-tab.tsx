'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Download, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
  const exportMutation = useMutation(trpc.audit.export.mutationOptions());

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
        <AuditLogTable
          data={[]}
          totalCount={0}
          page={1}
          pageSize={PAGE_SIZE}
          onPageChange={() => undefined}
          sortOrder="desc"
          onSortOrderChange={() => undefined}
          expandedRows={{}}
          onToggleRow={() => undefined}
          isLoading
        />
      </div>
    );
  }

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
            onChange={e => setLocalSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="ps-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exportMutation.isPending || totalCount === 0}>
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
          value={actorId}
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
          value={actionFilter}
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
                {t(`actions.${action}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Resource type filter */}
        <Select
          value={resourceType}
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
                {t(`resources.${rt}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range - from */}
        <Input
          type="date"
          value={dateFrom}
          onChange={e => {
            void setDateFrom(e.target.value || null);
            void setAuditPage('1');
          }}
          className="w-36"
          aria-label={tAria('dateFrom')}
        />

        {/* Date range - to */}
        <Input
          type="date"
          value={dateTo}
          onChange={e => {
            void setDateTo(e.target.value || null);
            void setAuditPage('1');
          }}
          className="w-36"
          aria-label={tAria('dateTo')}
        />
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
        isFetching={isRefetching}
      />
    </div>
  );
}
