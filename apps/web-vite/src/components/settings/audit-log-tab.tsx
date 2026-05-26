import { AtelierEmptyState, AuditLogIllustration, SectionLabel } from '@contractor-ops/ui';
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
import { Calendar as CalendarIcon, Download, Loader2, Search, Shield, X } from 'lucide-react';
import { useId } from 'react';
import { tDynLoose } from '../../i18n/typed-keys';
import { enumKey } from '../../lib/enum-key';
import { renderEmptyStateAction } from '../shared/atelier-bridges';
import { AuditLogTable } from './audit-log-table';
import type { useAuditLogTab } from './hooks/use-audit-log-tab.js';
import { AUDIT_LOG_PAGE_SIZE } from './hooks/use-audit-log-tab.js';

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

export type AuditLogTabProps = ReturnType<typeof useAuditLogTab>;

export function AuditLogTab({
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
  items,
  totalCount,
  expandedRows,
  handleToggleRow,
  handlePageChange,
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
}: AuditLogTabProps) {
  const reactId = useId();

  return (
    <div className="space-y-4">
      <SectionLabel icon={Shield}>{t('title')}</SectionLabel>
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

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
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
                        onClick={() => selectActor(actor.id)}
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
                  onSelect={handleDateRangeSelect}
                />
              </div>
              {!!(dateFrom || dateTo) && (
                <div className="border-t px-3 py-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearDates}>
                    {t('clearDates')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

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
                  onClick={clearActor}
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
                  onClick={clearDates}
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
          pageSize={AUDIT_LOG_PAGE_SIZE}
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
