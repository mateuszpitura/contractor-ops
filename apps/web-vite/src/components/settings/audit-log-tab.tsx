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
import type * as React from 'react';
import { useCallback, useId } from 'react';
import { tDynLoose } from '../../i18n/typed-keys';
import { enumKey } from '../../lib/enum-key';
import { renderEmptyStateAction } from '../shared/atelier-bridges';
import { AuditLogTable } from './audit-log/data-table.js';
import type { useAuditLogTab as UseAuditLogTab } from './hooks/use-audit-log-tab.js';
import { AUDIT_LOG_PAGE_SIZE, useAuditLogTab } from './hooks/use-audit-log-tab.js';

function ActorOptionButton({
  id,
  name,
  isSelected,
  onSelect,
}: {
  id: string;
  name: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-start text-sm hover:bg-accent ${isSelected ? 'bg-accent/60 font-medium text-foreground' : ''}`}>
      <span className="truncate">{name}</span>
    </button>
  );
}

interface FilterCheckboxRowProps<T extends string> {
  reactId: string;
  group: 'action' | 'resource';
  value: T;
  isChecked: boolean;
  label: string;
  onToggle: (value: T) => void;
}

function FilterCheckboxRow<T extends string>({
  reactId,
  group,
  value,
  isChecked,
  label,
  onToggle,
}: FilterCheckboxRowProps<T>) {
  const handleChange = useCallback(() => onToggle(value), [onToggle, value]);
  return (
    <label
      htmlFor={`${reactId}-${group}-${value}`}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox
        id={`${reactId}-${group}-${value}`}
        checked={isChecked}
        onCheckedChange={handleChange}
      />
      <span>{label}</span>
    </label>
  );
}

interface FilterChipProps<T extends string> {
  value: T;
  label: string;
  ariaLabel: string;
  onRemove: (value: T) => void;
}

function FilterChip<T extends string>({ value, label, ariaLabel, onRemove }: FilterChipProps<T>) {
  const handleClick = useCallback(() => onRemove(value), [onRemove, value]);
  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={handleClick}
        aria-label={ariaLabel}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

interface FilterTriggerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  count?: number;
  disabled?: boolean;
}

function FilterTriggerButton({ label, count, disabled, ...rest }: FilterTriggerButtonProps) {
  return (
    <Button {...rest} variant="outline" size="sm" className="h-8 gap-1.5" disabled={disabled}>
      <span className="truncate">{label}</span>
      {!!count && (
        <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
          {count}
        </Badge>
      )}
    </Button>
  );
}

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

export type AuditLogTabProps = ReturnType<typeof UseAuditLogTab>;

export function AuditLogTabView({
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
}: AuditLogTabProps) {
  const reactId = useId();

  const handleLocalSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLocalSearch(e.target.value),
    [setLocalSearch],
  );
  const handleActorQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setActorQuery(e.target.value),
    [setActorQuery],
  );
  const renderActorTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <FilterTriggerButton
        {...props}
        label={selectedActorLabel ?? t('filterActor')}
        count={actorId ? 1 : 0}
        disabled={isLoading}
      />
    ),
    [selectedActorLabel, t, actorId, isLoading],
  );
  const renderActionTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <FilterTriggerButton
        {...props}
        label={t('filterAction')}
        count={actions.length}
        disabled={isLoading}
      />
    ),
    [t, actions.length, isLoading],
  );
  const renderResourceTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <FilterTriggerButton
        {...props}
        label={t('filterResource')}
        count={resourceTypes.length}
        disabled={isLoading}
      />
    ),
    [t, resourceTypes.length, isLoading],
  );

  if (isTrulyEmpty && !isLoading) {
    return (
      <AtelierEmptyState
        variant="page"
        illustration={AuditLogIllustration}
        heading={tEmpty('heading')}
        body={tEmpty('body')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionLabel icon={Shield}>{t('title')}</SectionLabel>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localSearch}
            disabled={isLoading}
            onChange={handleLocalSearchChange}
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
            <PopoverTrigger render={renderActorTrigger} />
            <PopoverContent className="w-64 p-0" align="start">
              <div className="space-y-2 p-3">
                <h4 className="text-[13px] font-medium text-foreground">{t('filterActor')}</h4>
                <Input
                  placeholder={t('filterActorSearchPlaceholder')}
                  value={actorQuery}
                  onChange={handleActorQueryChange}
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
                  {visibleActorOptions.map(actor => (
                    <ActorOptionButton
                      key={actor.id}
                      id={actor.id}
                      name={actor.name}
                      isSelected={actor.id === actorId}
                      onSelect={selectActor}
                    />
                  ))}
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
            <PopoverTrigger render={renderActionTrigger} />
            <PopoverContent className="w-52 p-0" align="start">
              <div className="space-y-2 p-4">
                <h4 className="text-[13px] font-medium text-foreground">{t('filterAction')}</h4>
                <div className="space-y-1">
                  {ACTION_OPTIONS.map(action => (
                    <FilterCheckboxRow
                      key={action}
                      reactId={reactId}
                      group="action"
                      value={action}
                      isChecked={actions.includes(action)}
                      label={tDynLoose(t, 'actions', enumKey(action))}
                      onToggle={toggleAction}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger render={renderResourceTrigger} />
            <PopoverContent className="w-52 p-0" align="start">
              <div className="space-y-2 p-4">
                <h4 className="text-[13px] font-medium text-foreground">{t('filterResource')}</h4>
                <div className="space-y-1">
                  {RESOURCE_TYPE_OPTIONS.map(rt => (
                    <FilterCheckboxRow
                      key={rt}
                      reactId={reactId}
                      group="resource"
                      value={rt}
                      isChecked={resourceTypes.includes(rt)}
                      label={tDynLoose(t, 'resources', enumKey(rt))}
                      onToggle={toggleResourceType}
                    />
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
              <FilterChip
                key={`a-${a}`}
                value={a}
                label={tDynLoose(t, 'actions', enumKey(a))}
                ariaLabel={tAria('removeFilter', { label: tDynLoose(t, 'actions', enumKey(a)) })}
                onRemove={removeAction}
              />
            ))}
            {resourceTypes.map(rt => (
              <FilterChip
                key={`r-${rt}`}
                value={rt}
                label={tDynLoose(t, 'resources', enumKey(rt))}
                ariaLabel={tAria('removeFilter', { label: tDynLoose(t, 'resources', enumKey(rt)) })}
                onRemove={removeResourceType}
              />
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

      <AuditLogTable
        data={items}
        totalCount={totalCount}
        page={currentPage}
        pageSize={currentPageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
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

export function AuditLogTab() {
  const auditLog = useAuditLogTab();
  return <AuditLogTabView {...auditLog} />;
}
