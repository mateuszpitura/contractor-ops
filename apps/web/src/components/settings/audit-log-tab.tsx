'use client';

import { AtelierEmptyState, AuditLogIllustration, SectionLabel } from '@contractor-ops/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Download, Loader2, Search, Shield, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { tDynLoose } from '@/i18n/typed-keys';

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

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { toast } from 'sonner';
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
  const tEmpty = useTranslations('EmptyStates.auditLog');
  const reactId = useId();

  // ---------------------------------------------------------------------------
  // URL state (nuqs)
  // ---------------------------------------------------------------------------

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
  const [auditSort, setAuditSort] = useQueryState('auditSort', parseAsString.withDefault('desc'));

  // Memoised DateRange for react-day-picker. Pass a stable reference so the
  // picker's modifier matcher correctly highlights `range_middle` cells between
  // `from` and `to`. (Computing the object inline produced a new reference each
  // render which made the middle highlight intermittently disappear.)
  const dateRangeValue = useMemo<DateRange | undefined>(() => {
    if (!(dateFrom || dateTo)) return;
    return {
      from: dateFrom ? parseLocalDate(dateFrom) : undefined,
      to: dateTo ? parseLocalDate(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

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

  // API accepts only a single value — when 2+ filters selected the API returns
  // unfiltered results for that dimension (same tradeoff as approvals/payments).
  const apiAction = actions.length === 1 ? actions[0] : undefined;
  const apiResourceType = resourceTypes.length === 1 ? resourceTypes[0] : undefined;

  const queryInput = useMemo(
    () => ({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      actorId: actorId || undefined,
      action: apiAction,
      resourceType: apiResourceType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortOrder: (auditSort as 'asc' | 'desc') || 'desc',
    }),
    [currentPage, search, actorId, apiAction, apiResourceType, dateFrom, dateTo, auditSort],
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
  const totalCount = (listQuery.data?.total as number) ?? 0;

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
        action: apiAction,
        resourceType: apiResourceType,
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
    apiAction,
    apiResourceType,
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

  // Searchable actor select state — mirrors the owner-filter pattern used in
  // the contract / contractor tables: max 10 rows shown unless the user starts
  // typing, then we filter against the local query string.
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
    // No query → keep the selected actor pinned at the top (if any) and show
    // up to MAX_VISIBLE_ACTORS others.
    const selected = actorId ? filteredActorOptions.filter(a => a.id === actorId) : [];
    const rest = filteredActorOptions.filter(a => a.id !== actorId).slice(0, MAX_VISIBLE_ACTORS);
    return [...selected, ...rest];
  }, [filteredActorOptions, actorId, actorQuery]);

  // ---------------------------------------------------------------------------
  // Multi-select toggles + clear-all
  // ---------------------------------------------------------------------------

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

  const activeFilterCount =
    actions.length + resourceTypes.length + (actorId ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  const isLoading = listQuery.isPending && !listQuery.data;
  const isRefetching = listQuery.isFetching && !isLoading;

  const hasAnyFilter = activeFilterCount > 0 || (typeof search === 'string' && search.length > 0);
  const isTrulyEmpty = !isLoading && items.length === 0 && !hasAnyFilter;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <SectionLabel icon={Shield}>{t('title')}</SectionLabel>
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

      {/* Filter row + active badges */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Actor filter — searchable single-select popover (max 10 visible
            + free-text query) matches the owner-filter pattern from
            contracts/contractors tables. */}
          <Popover open={actorOpen} onOpenChange={setActorOpen}>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isLoading}>
                  <span className="truncate">{selectedActorLabel ?? t('filterActor')}</span>
                  {actorId && (
                    <Badge
                      variant="secondary"
                      className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                      1
                    </Badge>
                  )}
                </Button>
              )}
            />
            <PopoverContent className="w-64 p-0" align="start">
              <div className="space-y-2 p-3">
                <h4 className="text-[13px] font-medium text-foreground">{t('filterActor')}</h4>
                <Input
                  placeholder={t('filterActorSearchPlaceholder')}
                  value={actorQuery}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={e => setActorQuery(e.target.value)}
                  className="h-7 text-xs"
                />
                {!actorQuery.trim() && actorOptions.length > MAX_VISIBLE_ACTORS && (
                  <p className="text-[10px] text-muted-foreground">
                    {t('filterActorShowingHint', {
                      visible: MAX_VISIBLE_ACTORS,
                      total: actorOptions.length,
                    })}
                  </p>
                )}
                <div className="space-y-1">
                  {visibleActorOptions.map(actor => {
                    const isSelected = actor.id === actorId;
                    return (
                      <button
                        key={actor.id}
                        type="button"
                        onClick={() => {
                          void setActorId(actor.id);
                          void setAuditPage('1');
                          setActorQuery('');
                          setActorOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-start text-sm hover:bg-accent ${isSelected ? 'bg-accent/60 font-medium text-foreground' : ''}`}>
                        <span className="truncate">{actor.name}</span>
                      </button>
                    );
                  })}
                  {visibleActorOptions.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      {t('filterActorNoMatches')}
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Action filter — multi-select */}
          <Popover>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isLoading}>
                  {t('filterAction')}
                  {actions.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                      {actions.length}
                    </Badge>
                  )}
                </Button>
              )}
            />
            <PopoverContent className="w-52 p-0" align="start">
              <div className="space-y-2 p-4">
                <h4 className="text-[13px] font-medium text-foreground">{t('filterAction')}</h4>
                <div className="space-y-1">
                  {ACTION_OPTIONS.map(action => (
                    <label
                      key={action}
                      htmlFor={`${reactId}-action-${action}`}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                      <Checkbox
                        id={`${reactId}-action-${action}`}
                        checked={actions.includes(action)}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                        onCheckedChange={() => toggleAction(action)}
                      />
                      <span>{tDynLoose(t, 'actions', enumKey(action))}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Resource type filter — multi-select */}
          <Popover>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isLoading}>
                  {t('filterResource')}
                  {resourceTypes.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                      {resourceTypes.length}
                    </Badge>
                  )}
                </Button>
              )}
            />
            <PopoverContent className="w-52 p-0" align="start">
              <div className="space-y-2 p-4">
                <h4 className="text-[13px] font-medium text-foreground">{t('filterResource')}</h4>
                <div className="space-y-1">
                  {RESOURCE_TYPE_OPTIONS.map(rt => (
                    <label
                      key={rt}
                      htmlFor={`${reactId}-resource-${rt}`}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                      <Checkbox
                        id={`${reactId}-resource-${rt}`}
                        checked={resourceTypes.includes(rt)}
                        // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                        onCheckedChange={() => toggleResourceType(rt)}
                      />
                      <span>{tDynLoose(t, 'resources', enumKey(rt))}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

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
              <div className="p-3">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={dateRangeValue}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onSelect={(range, triggerDate) => {
                    if (!range) {
                      void setDateFrom(null);
                      void setDateTo(null);
                      void setAuditPage('1');
                      return;
                    }

                    const currentFrom = dateFrom ? parseLocalDate(dateFrom) : undefined;
                    const currentTo = dateTo ? parseLocalDate(dateTo) : undefined;

                    // When both dates were set and library restarted selection (from only,
                    // no to), adjust the nearest boundary instead of resetting the range.
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
                  }}
                />
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

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.map(a => (
              <Badge key={`a-${a}`} variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
                <span className="text-xs">{tDynLoose(t, 'actions', enumKey(a))}</span>
                <button
                  type="button"
                  className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => removeAction(a)}
                  aria-label={tAria('removeFilter', {
                    label: tDynLoose(t, 'actions', enumKey(a)),
                  })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {resourceTypes.map(rt => (
              <Badge key={`r-${rt}`} variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
                <span className="text-xs">{tDynLoose(t, 'resources', enumKey(rt))}</span>
                <button
                  type="button"
                  className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => removeResourceType(rt)}
                  aria-label={tAria('removeFilter', {
                    label: tDynLoose(t, 'resources', enumKey(rt)),
                  })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {actorId && (
              <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
                <span className="text-xs">
                  {actorOptions.find(a => a.id === actorId)?.name ?? actorId}
                </span>
                <button
                  type="button"
                  className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={() => {
                    void setActorId(null);
                    void setAuditPage('1');
                  }}
                  aria-label={tAria('removeFilter', {
                    label: actorOptions.find(a => a.id === actorId)?.name ?? actorId,
                  })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(dateFrom || dateTo) && (
              <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
                <span className="text-xs">
                  {dateFrom && dateTo
                    ? `${dateFrom} – ${dateTo}`
                    : dateFrom
                      ? t('dateFromPrefix', { date: dateFrom })
                      : t('dateToPrefix', { date: dateTo })}
                </span>
                <button
                  type="button"
                  className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={() => {
                    void setDateFrom(null);
                    void setDateTo(null);
                    void setAuditPage('1');
                  }}
                  aria-label={tAria('removeFilter', {
                    label: t('filterDateRange'),
                  })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              type="button"
              className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
              onClick={clearAllFilters}>
              {t('clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Table or empty state */}
      {isTrulyEmpty ? (
        <AtelierEmptyState
          variant="subview"
          illustration={AuditLogIllustration}
          heading={tEmpty('heading')}
          body={tEmpty('body')}
          renderAction={renderEmptyStateAction}
        />
      ) : (
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
      )}
    </div>
  );
}
