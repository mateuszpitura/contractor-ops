'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers — timezone-safe date ↔ YYYY-MM-DD conversion
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterState {
  status: string[];
  type: string[];
  billingModel: string[];
  ownerUserId: string[];
  startDateFrom: string;
  startDateTo: string;
  endDateFrom: string;
  endDateTo: string;
  complianceRiskLevel: string[];
}

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  /** Disable all interactive filter controls (initial data load). */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const CONTRACT_STATUSES = [
  'DRAFT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'TERMINATED',
  'SUPERSEDED',
  'ARCHIVED',
] as const;

const CONTRACT_TYPES = [
  'B2B_MASTER_SERVICE',
  'STATEMENT_OF_WORK',
  'NDA',
  'IP_ASSIGNMENT',
  'DPA',
  'OTHER',
] as const;

const BILLING_MODELS = [
  'MONTHLY_RETAINER',
  'HOURLY',
  'DAILY',
  'MILESTONE',
  'DELIVERABLE_BASED',
  'MIXED',
] as const;

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter popover and active filter badges for the contract data table.
 */
export function DataTableFilters({
  filters,
  onFiltersChange,
  disabled: filtersDisabled,
}: DataTableFiltersProps) {
  const t = useTranslations('Contracts');

  // Fetch users for owner filter
  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  // Active filter count for badge
  const activeFilterCount =
    filters.status.length +
    filters.type.length +
    filters.billingModel.length +
    filters.ownerUserId.length +
    filters.complianceRiskLevel.length +
    (filters.startDateFrom ? 1 : 0) +
    (filters.startDateTo ? 1 : 0) +
    (filters.endDateFrom ? 1 : 0) +
    (filters.endDateTo ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      status: [],
      type: [],
      billingModel: [],
      ownerUserId: [],
      startDateFrom: '',
      startDateTo: '',
      endDateFrom: '',
      endDateTo: '',
      complianceRiskLevel: [],
    });
  }, [onFiltersChange]);

  const toggleFilterValue = useCallback(
    (
      key: 'status' | 'type' | 'billingModel' | 'ownerUserId' | 'complianceRiskLevel',
      value: string,
    ) => {
      const current = filters[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (
      key: 'status' | 'type' | 'billingModel' | 'ownerUserId' | 'complianceRiskLevel',
      value: string,
    ) => {
      onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
    },
    [filters, onFiltersChange],
  );

  return (
    <>
      {/* Filter popover button */}
      <Popover>
        <PopoverTrigger
          // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
          render={props => (
            <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
              <Filter className="h-3.5 w-3.5" />
              {t('filters')}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="max-h-[460px] overflow-y-auto p-4 space-y-4">
            {/* Status */}
            <FilterSection
              title={t('columns.status')}
              options={CONTRACT_STATUSES.map(s => ({
                value: s,
                label: t(`status.${enumKey(s)}`),
              }))}
              selected={filters.status}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onToggle={value => toggleFilterValue('status', value)}
            />

            {/* Type */}
            <FilterSection
              title={t('columns.type')}
              options={CONTRACT_TYPES.map(ct => ({
                value: ct,
                label: t(`type.${enumKey(ct)}`),
              }))}
              selected={filters.type}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onToggle={value => toggleFilterValue('type', value)}
            />

            {/* Billing model */}
            <FilterSection
              title={t('columns.billingCycle')}
              options={BILLING_MODELS.map(bm => ({
                value: bm,
                label: t(`billingModel.${enumKey(bm)}`),
              }))}
              selected={filters.billingModel}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onToggle={value => toggleFilterValue('billingModel', value)}
            />

            {/* Owner */}
            <FilterSection
              title={t('columns.owner')}
              options={(
                users as Array<{
                  id?: string;
                  userId?: string;
                  name?: string | null;
                  email?: string | null;
                }>
              ).map(user => ({
                value: user.userId ?? user.id ?? '',
                label: user.name ?? user.email ?? 'Unknown',
              }))}
              selected={filters.ownerUserId}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onToggle={value => toggleFilterValue('ownerUserId', value)}
              searchable
            />

            {/* Compliance risk */}
            <FilterSection
              title={t('columns.complianceRisk')}
              options={RISK_LEVELS.map(rl => ({
                value: rl,
                label: t(`risk.${enumKey(rl)}`),
              }))}
              selected={filters.complianceRiskLevel}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onToggle={value => toggleFilterValue('complianceRiskLevel', value)}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Contract start date range — standalone picker */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="lg" disabled={filtersDisabled} className="gap-1.5" />
          }>
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="text-xs">
            {filters.startDateFrom && filters.startDateTo
              ? `${filters.startDateFrom} – ${filters.startDateTo}`
              : filters.startDateFrom
                ? `From ${filters.startDateFrom}`
                : filters.startDateTo
                  ? `To ${filters.startDateTo}`
                  : t('columns.startDate')}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3">
            <Calendar
              mode="range"
              selected={
                filters.startDateFrom || filters.startDateTo
                  ? {
                      from: filters.startDateFrom
                        ? parseLocalDate(filters.startDateFrom)
                        : undefined,
                      to: filters.startDateTo ? parseLocalDate(filters.startDateTo) : undefined,
                    }
                  : undefined
              }
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onSelect={range => {
                onFiltersChange({
                  startDateFrom: range?.from ? toLocalDateString(range.from) : '',
                  startDateTo: range?.to ? toLocalDateString(range.to) : '',
                });
              }}
              numberOfMonths={2}
            />
          </div>
          {!!(filters.startDateFrom || filters.startDateTo) && (
            <div className="border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => onFiltersChange({ startDateFrom: '', startDateTo: '' })}>
                {t('clearAll')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Contract end date range — standalone picker */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="lg" disabled={filtersDisabled} className="gap-1.5" />
          }>
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="text-xs">
            {filters.endDateFrom && filters.endDateTo
              ? `${filters.endDateFrom} – ${filters.endDateTo}`
              : filters.endDateFrom
                ? `From ${filters.endDateFrom}`
                : filters.endDateTo
                  ? `To ${filters.endDateTo}`
                  : t('columns.endDate')}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3">
            <Calendar
              mode="range"
              selected={
                filters.endDateFrom || filters.endDateTo
                  ? {
                      from: filters.endDateFrom ? parseLocalDate(filters.endDateFrom) : undefined,
                      to: filters.endDateTo ? parseLocalDate(filters.endDateTo) : undefined,
                    }
                  : undefined
              }
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onSelect={range => {
                onFiltersChange({
                  endDateFrom: range?.from ? toLocalDateString(range.from) : '',
                  endDateTo: range?.to ? toLocalDateString(range.to) : '',
                });
              }}
              numberOfMonths={2}
            />
          </div>
          {!!(filters.endDateFrom || filters.endDateTo) && (
            <div className="border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => onFiltersChange({ endDateFrom: '', endDateTo: '' })}>
                {t('clearAll')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.status.map(s => (
            <FilterBadge
              key={`status-${s}`}
              label={t(`status.${enumKey(s)}` as Parameters<typeof t>[0])}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('status', s)}
            />
          ))}
          {filters.type.map(ct => (
            <FilterBadge
              key={`type-${ct}`}
              label={t(`type.${enumKey(ct)}` as Parameters<typeof t>[0])}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('type', ct)}
            />
          ))}
          {filters.billingModel.map(bm => (
            <FilterBadge
              key={`billing-${bm}`}
              label={t(`billingModel.${enumKey(bm)}` as Parameters<typeof t>[0])}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('billingModel', bm)}
            />
          ))}
          {filters.ownerUserId.map(ownerId => {
            const user = (
              users as Array<{
                id?: string;
                userId?: string;
                name?: string | null;
                email?: string | null;
              }>
            ).find(u => (u.userId ?? u.id) === ownerId);
            return (
              <FilterBadge
                key={`owner-${ownerId}`}
                label={user?.name ?? user?.email ?? ownerId}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onRemove={() => removeFilter('ownerUserId', ownerId)}
              />
            );
          })}
          {filters.complianceRiskLevel.map(rl => (
            <FilterBadge
              key={`risk-${rl}`}
              label={t(`risk.${enumKey(rl)}` as Parameters<typeof t>[0])}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('complianceRiskLevel', rl)}
            />
          ))}
          {!!filters.endDateFrom && (
            <FilterBadge
              label={`${t('dateFrom')}: ${filters.endDateFrom}`}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => onFiltersChange({ endDateFrom: '' })}
            />
          )}
          {!!filters.endDateTo && (
            <FilterBadge
              label={`${t('dateTo')}: ${filters.endDateTo}`}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => onFiltersChange({ endDateTo: '' })}
            />
          )}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            onClick={clearAllFilters}>
            {t('clearAll')}
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterSection({
  title,
  options,
  selected,
  onToggle,
  searchable,
  maxVisible = 10,
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  searchable?: boolean;
  maxVisible?: number;
}) {
  const filterId = useId();
  const [query, setQuery] = useState('');

  if (options.length === 0) return null;

  const filtered =
    searchable && query
      ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
      : options;

  const selectedOptions = filtered.filter(o => selected.includes(o.value));
  const unselectedOptions = filtered.filter(o => !selected.includes(o.value));
  const visibleOptions = searchable
    ? [...selectedOptions, ...unselectedOptions.slice(0, maxVisible)]
    : filtered;

  return (
    <div className="space-y-2">
      <h4 className="text-[13px] font-medium text-foreground">{title}</h4>
      {!!searchable && (
        <>
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            value={query}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setQuery(e.target.value)}
            className="h-7 text-xs"
          />
          {!query && unselectedOptions.length > maxVisible && (
            <p className="text-[10px] text-muted-foreground">
              Showing {maxVisible} of {options.length}. Type to search.
            </p>
          )}
        </>
      )}
      <div className="space-y-1">
        {visibleOptions.map(option => (
          <label
            key={option.value}
            htmlFor={`${filterId}-filter-${option.value}`}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Checkbox
              id={`${filterId}-filter-${option.value}`}
              checked={selected.includes(option.value)}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onCheckedChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  const tAria = useTranslations('Common.aria');

  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={onRemove}
        aria-label={tAria('removeFilter', { label })}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
