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
import {
  billingModelEnum,
  complianceRiskLevelEnum,
  contractStatusEnum,
  contractTypeEnum,
} from '@contractor-ops/validators';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { memo, useCallback, useId, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ContractUserOption } from '../hooks/use-contract-list.js';

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

export interface FilterState {
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

type ToggleKey = 'status' | 'type' | 'billingModel' | 'ownerUserId' | 'complianceRiskLevel';

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  users: ContractUserOption[];
  /** Disable all interactive filter controls (initial data load). */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter popover and active filter badges for the contract data table.
 */
export function DataTableFilters({
  filters,
  onFiltersChange,
  users,
  disabled: filtersDisabled,
}: DataTableFiltersProps) {
  const t = useTranslations('Contracts');

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

  const toggleFilterValue = useCallback(
    (key: ToggleKey, value: string) => {
      const current = filters[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const toggleStatus = useCallback(
    (value: string) => toggleFilterValue('status', value),
    [toggleFilterValue],
  );
  const toggleType = useCallback(
    (value: string) => toggleFilterValue('type', value),
    [toggleFilterValue],
  );
  const toggleBillingModel = useCallback(
    (value: string) => toggleFilterValue('billingModel', value),
    [toggleFilterValue],
  );
  const toggleOwnerUserId = useCallback(
    (value: string) => toggleFilterValue('ownerUserId', value),
    [toggleFilterValue],
  );
  const toggleComplianceRiskLevel = useCallback(
    (value: string) => toggleFilterValue('complianceRiskLevel', value),
    [toggleFilterValue],
  );

  const renderFilterTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
        <Filter className="h-3.5 w-3.5" />
        {t('filters')}
        {hasActiveFilters && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    ),
    [activeFilterCount, filtersDisabled, hasActiveFilters, t],
  );

  const statusOptions = useMemo(
    () =>
      contractStatusEnum.options.map(s => ({
        value: s as string,
        label: tDynLoose(t, 'status', enumKey(s)),
      })),
    [t],
  );
  const typeOptions = useMemo(
    () =>
      contractTypeEnum.options.map(ct => ({
        value: ct as string,
        label: tDynLoose(t, 'type', enumKey(ct)),
      })),
    [t],
  );
  const billingOptions = useMemo(
    () =>
      billingModelEnum.options.map(bm => ({
        value: bm as string,
        label: tDynLoose(t, 'billingModel', enumKey(bm)),
      })),
    [t],
  );
  const ownerOptions = useMemo(
    () =>
      (
        users as Array<{
          id?: string;
          userId?: string;
          name?: string | null;
          email?: string | null;
        }>
      ).map(user => ({
        value: user.userId ?? user.id ?? '',
        label: user.name ?? user.email ?? 'Unknown',
      })),
    [users],
  );
  const riskOptions = useMemo(
    () =>
      complianceRiskLevelEnum.options.map(rl => ({
        value: rl as string,
        label: tDynLoose(t, 'risk', enumKey(rl)),
      })),
    [t],
  );

  const handleStartDateRange = useCallback(
    (range: DateRange | undefined) => {
      onFiltersChange({
        startDateFrom: range?.from ? toLocalDateString(range.from) : '',
        startDateTo: range?.to ? toLocalDateString(range.to) : '',
      });
    },
    [onFiltersChange],
  );
  const handleEndDateRange = useCallback(
    (range: DateRange | undefined) => {
      onFiltersChange({
        endDateFrom: range?.from ? toLocalDateString(range.from) : '',
        endDateTo: range?.to ? toLocalDateString(range.to) : '',
      });
    },
    [onFiltersChange],
  );
  const handleClearStartDate = useCallback(
    () => onFiltersChange({ startDateFrom: '', startDateTo: '' }),
    [onFiltersChange],
  );
  const handleClearEndDate = useCallback(
    () => onFiltersChange({ endDateFrom: '', endDateTo: '' }),
    [onFiltersChange],
  );

  return (
    <>
      <Popover>
        <PopoverTrigger render={renderFilterTrigger} />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="max-h-[460px] overflow-y-auto p-4 space-y-4">
            <FilterSection
              title={t('columns.status')}
              options={statusOptions}
              selected={filters.status}
              onToggle={toggleStatus}
            />

            <FilterSection
              title={t('columns.type')}
              options={typeOptions}
              selected={filters.type}
              onToggle={toggleType}
            />

            <FilterSection
              title={t('columns.billingCycle')}
              options={billingOptions}
              selected={filters.billingModel}
              onToggle={toggleBillingModel}
            />

            <FilterSection
              title={t('columns.owner')}
              options={ownerOptions}
              selected={filters.ownerUserId}
              onToggle={toggleOwnerUserId}
              searchable
            />

            <FilterSection
              title={t('columns.complianceRisk')}
              options={riskOptions}
              selected={filters.complianceRiskLevel}
              onToggle={toggleComplianceRiskLevel}
            />
          </div>
        </PopoverContent>
      </Popover>

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
                ? `${t('dateFrom')} ${filters.startDateFrom}`
                : filters.startDateTo
                  ? `${t('dateTo')} ${filters.startDateTo}`
                  : t('columns.startDate')}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <DateRangeCalendarPanel
            fromValue={filters.startDateFrom}
            toValue={filters.startDateTo}
            onApply={handleStartDateRange}
            onClear={handleClearStartDate}
            clearLabel={t('clearAll')}
          />
        </PopoverContent>
      </Popover>

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
          <DateRangeCalendarPanel
            fromValue={filters.endDateFrom}
            toValue={filters.endDateTo}
            onApply={handleEndDateRange}
            onClear={handleClearEndDate}
            clearLabel={t('clearAll')}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Active filter badges — rendered below the toolbar row (not inline with the
// filter controls) so removable pills stack under the search/filter bar,
// matching the contractors/invoices toolbars.
// ---------------------------------------------------------------------------

export function ActiveFilterBadges({
  filters,
  onFiltersChange,
  users,
}: {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  users: ContractUserOption[];
}) {
  const t = useTranslations('Contracts');

  const hasActiveFilters =
    filters.status.length +
      filters.type.length +
      filters.billingModel.length +
      filters.ownerUserId.length +
      filters.complianceRiskLevel.length +
      (filters.startDateFrom ? 1 : 0) +
      (filters.startDateTo ? 1 : 0) +
      (filters.endDateFrom ? 1 : 0) +
      (filters.endDateTo ? 1 : 0) >
    0;

  const removeFilter = useCallback(
    (key: ToggleKey, value: string) => {
      onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
    },
    [filters, onFiltersChange],
  );

  const clearEndDateField = useCallback(
    (field: 'endDateFrom' | 'endDateTo') => onFiltersChange({ [field]: '' }),
    [onFiltersChange],
  );

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

  if (!hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.status.map(s => (
        <RemovableFilterBadgeMemo
          key={`status-${s}`}
          label={tDynLoose(t, 'status', enumKey(s))}
          filterKey="status"
          filterValue={s}
          onRemove={removeFilter}
        />
      ))}
      {filters.type.map(ct => (
        <RemovableFilterBadgeMemo
          key={`type-${ct}`}
          label={tDynLoose(t, 'type', enumKey(ct))}
          filterKey="type"
          filterValue={ct}
          onRemove={removeFilter}
        />
      ))}
      {filters.billingModel.map(bm => (
        <RemovableFilterBadgeMemo
          key={`billing-${bm}`}
          label={tDynLoose(t, 'billingModel', enumKey(bm))}
          filterKey="billingModel"
          filterValue={bm}
          onRemove={removeFilter}
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
          <RemovableFilterBadgeMemo
            key={`owner-${ownerId}`}
            label={user?.name ?? user?.email ?? ownerId}
            filterKey="ownerUserId"
            filterValue={ownerId}
            onRemove={removeFilter}
          />
        );
      })}
      {filters.complianceRiskLevel.map(rl => (
        <RemovableFilterBadgeMemo
          key={`risk-${rl}`}
          label={tDynLoose(t, 'risk', enumKey(rl))}
          filterKey="complianceRiskLevel"
          filterValue={rl}
          onRemove={removeFilter}
        />
      ))}
      {!!filters.endDateFrom && (
        <DateBadge
          label={`${t('dateFrom')}: ${filters.endDateFrom}`}
          field="endDateFrom"
          onClear={clearEndDateField}
        />
      )}
      {!!filters.endDateTo && (
        <DateBadge
          label={`${t('dateTo')}: ${filters.endDateTo}`}
          field="endDateTo"
          onClear={clearEndDateField}
        />
      )}
      <button
        type="button"
        className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
        onClick={clearAllFilters}>
        {t('clearAll')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DateRangeCalendarPanel({
  fromValue,
  toValue,
  onApply,
  onClear,
  clearLabel,
}: {
  fromValue: string;
  toValue: string;
  onApply: (range: DateRange | undefined) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  const selected = useMemo<DateRange | undefined>(() => {
    if (!(fromValue || toValue)) return;
    return {
      from: fromValue ? parseLocalDate(fromValue) : undefined,
      to: toValue ? parseLocalDate(toValue) : undefined,
    };
  }, [fromValue, toValue]);

  const hasValue = Boolean(fromValue || toValue);

  return (
    <>
      <div className="p-3">
        <Calendar mode="range" selected={selected} onSelect={onApply} numberOfMonths={2} />
      </div>
      {!!hasValue && (
        <div className="border-t px-3 py-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            {clearLabel}
          </Button>
        </div>
      )}
    </>
  );
}

function FilterCheckboxRow({
  filterId,
  option,
  isSelected,
  onToggle,
}: {
  filterId: string;
  option: { value: string; label: string };
  isSelected: boolean;
  onToggle: (value: string) => void;
}) {
  const handleCheckedChange = useCallback(() => onToggle(option.value), [onToggle, option.value]);

  return (
    <label
      htmlFor={`${filterId}-filter-${option.value}`}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox
        id={`${filterId}-filter-${option.value}`}
        checked={isSelected}
        onCheckedChange={handleCheckedChange}
      />
      <span>{option.label}</span>
    </label>
  );
}

const FilterCheckboxRowMemo = memo(FilterCheckboxRow);

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

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    [],
  );

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
            onChange={handleQueryChange}
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
          <FilterCheckboxRowMemo
            key={option.value}
            filterId={filterId}
            option={option}
            isSelected={selected.includes(option.value)}
            onToggle={onToggle}
          />
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

function RemovableFilterBadge({
  label,
  filterKey,
  filterValue,
  onRemove,
}: {
  label: string;
  filterKey: ToggleKey;
  filterValue: string;
  onRemove: (key: ToggleKey, value: string) => void;
}) {
  const handleRemove = useCallback(
    () => onRemove(filterKey, filterValue),
    [filterKey, filterValue, onRemove],
  );
  return <FilterBadge label={label} onRemove={handleRemove} />;
}

const RemovableFilterBadgeMemo = memo(RemovableFilterBadge);

function DateBadge({
  label,
  field,
  onClear,
}: {
  label: string;
  field: 'endDateFrom' | 'endDateTo';
  onClear: (field: 'endDateFrom' | 'endDateTo') => void;
}) {
  const handleRemove = useCallback(() => onClear(field), [field, onClear]);
  return <FilterBadge label={label} onRemove={handleRemove} />;
}
