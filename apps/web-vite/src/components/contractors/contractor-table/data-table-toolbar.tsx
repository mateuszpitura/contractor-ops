import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { complianceHealthEnum, contractorTypeEnum } from '@contractor-ops/validators';
import { Filter, Loader2, Plus, Search, Upload, X } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ContractorListToolbarProps } from '../hooks/use-contractor-list.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterState {
  lifecycleStage: string[];
  type: string[];
  owner: string[];
  team: string[];
  billingModel: string[];
  health: string[];
}

type DataTableToolbarProps = ContractorListToolbarProps;

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

// Lifecycle stages rendered as a horizontal chip bar at the top of the
// toolbar (mirrors the /approvals status-chips pattern). Multi-select: no
// chips active = all stages.
const LIFECYCLE_STAGE_CHIPS = [
  { key: 'DRAFT', labelKey: 'lifecycle.draft' },
  { key: 'ONBOARDING', labelKey: 'lifecycle.onboarding' },
  { key: 'ACTIVE', labelKey: 'lifecycle.active' },
  { key: 'OFFBOARDING', labelKey: 'lifecycle.offboarding' },
  { key: 'ENDED', labelKey: 'lifecycle.ended' },
] as const;

const BILLING_MODELS = ['FIXED', 'HOURLY', 'PROJECT', 'MILESTONE'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar with search input, filter popover, active filter badges, and CTA.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  users,
  isSearching,
  disabled: filtersDisabled,
  onAddContractor,
  onImport,
}: DataTableToolbarProps) {
  const t = useTranslations('Contractors');

  // Debounced search
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value.length >= 2 ? value : '');
      }, 300);
    },
    [onSearchChange],
  );

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      lifecycleStage: [],
      type: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
    });
  }, [onFiltersChange]);

  const toggleFilterValue = useCallback(
    (key: keyof FilterState, value: string) => {
      const current = filters[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (key: keyof FilterState, value: string) => {
      onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
    },
    [filters, onFiltersChange],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleSearchInput(e.target.value),
    [handleSearchInput],
  );

  const handleToggleType = useCallback(
    (value: string) => toggleFilterValue('type', value),
    [toggleFilterValue],
  );
  const handleToggleOwner = useCallback(
    (value: string) => toggleFilterValue('owner', value),
    [toggleFilterValue],
  );
  const handleToggleBillingModel = useCallback(
    (value: string) => toggleFilterValue('billingModel', value),
    [toggleFilterValue],
  );
  const handleToggleHealth = useCallback(
    (value: string) => toggleFilterValue('health', value),
    [toggleFilterValue],
  );

  const userOptions = useMemo(
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

  const typeOptions = useMemo(
    () =>
      contractorTypeEnum.options.map(ct => ({
        value: ct,
        label: tDynLoose(t, 'type', enumKey(ct)),
      })),
    [t],
  );

  const billingOptions = useMemo(
    () =>
      BILLING_MODELS.map(model => ({
        value: model,
        label: tDynLoose(t, 'billingModel', enumKey(model)),
      })),
    [t],
  );

  const healthOptions = useMemo(
    () =>
      complianceHealthEnum.options.map(health => ({
        value: health,
        label: tDynLoose(t, 'health', enumKey(health)),
      })),
    [t],
  );

  // Secondary filters (everything except lifecycleStage which is rendered as
  // the dedicated dropdown to the left of the Filters popover).
  const secondaryFilterCount =
    filters.type.length +
    filters.owner.length +
    filters.team.length +
    filters.billingModel.length +
    filters.health.length;
  const hasSecondaryFilters = secondaryFilterCount > 0;
  const hasActiveFilters = filters.lifecycleStage.length > 0 || hasSecondaryFilters;

  const renderLifecycleTrigger = useCallback(
    (props: HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
        {t('columns.lifecycleStage')}
        {filters.lifecycleStage.length > 0 && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {filters.lifecycleStage.length}
          </Badge>
        )}
      </Button>
    ),
    [filtersDisabled, t, filters.lifecycleStage.length],
  );

  const renderFiltersTrigger = useCallback(
    (props: HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
        <Filter className="h-3.5 w-3.5" />
        {t('filters')}
        {hasSecondaryFilters && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {secondaryFilterCount}
          </Badge>
        )}
      </Button>
    ),
    [filtersDisabled, t, hasSecondaryFilters, secondaryFilterCount],
  );

  return (
    <div className="space-y-3">
      {/* Search + status filter + advanced filters + actions row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={localSearch}
            disabled={filtersDisabled}
            onChange={handleSearchChange}
            className="h-9 ps-9 pe-8"
          />
          {!!isSearching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Status multi-select */}
        <Popover>
          <PopoverTrigger render={renderLifecycleTrigger} />
          <PopoverContent className="w-52 p-0" align="start">
            <div className="p-4 space-y-2">
              <h4 className="text-[13px] font-medium text-foreground">
                {t('columns.lifecycleStage')}
              </h4>
              <div className="space-y-1">
                {LIFECYCLE_STAGE_CHIPS.map(chip => (
                  <LifecycleChipRow
                    key={chip.key}
                    chipKey={chip.key}
                    label={t(chip.labelKey)}
                    checked={filters.lifecycleStage.includes(chip.key)}
                    onToggle={toggleFilterValue}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Advanced filters popover (no lifecycle — that lives in chip bar) */}
        <Popover>
          <PopoverTrigger render={renderFiltersTrigger} />
          <PopoverContent className="w-72 p-0" align="start">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
              {/* Type */}
              <FilterSection
                title={t('columns.type')}
                options={typeOptions}
                selected={filters.type}
                onToggle={handleToggleType}
              />

              {/* Owner */}
              <FilterSection
                title={t('columns.owner')}
                options={userOptions}
                selected={filters.owner}
                onToggle={handleToggleOwner}
                searchable
              />

              {/* Billing model */}
              <FilterSection
                title={t('columns.billingModel')}
                options={billingOptions}
                selected={filters.billingModel}
                onToggle={handleToggleBillingModel}
              />

              {/* Compliance health */}
              <FilterSection
                title={t('columns.health')}
                options={healthOptions}
                selected={filters.health}
                onToggle={handleToggleHealth}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Import CTA — icon-only on mobile to keep the primary CTA inside
            the viewport on 375px viewports. */}
        {!!onImport && (
          <Button
            size="lg"
            variant="outline"
            disabled={filtersDisabled}
            onClick={onImport}
            aria-label={t('import')}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('import')}</span>
          </Button>
        )}

        {/* Add contractor CTA — icon-only on mobile (full label from sm+). */}
        <Button
          size="lg"
          disabled={filtersDisabled}
          onClick={onAddContractor}
          aria-label={t('addContractor')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('addContractor')}</span>
        </Button>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.lifecycleStage.map(stage => (
            <RemovableFilterBadge
              key={`lifecycle-${stage}`}
              filterKey="lifecycleStage"
              value={stage}
              label={tDynLoose(t, 'lifecycle', enumKey(stage))}
              onRemove={removeFilter}
            />
          ))}
          {filters.type.map(ct => (
            <RemovableFilterBadge
              key={`type-${ct}`}
              filterKey="type"
              value={ct}
              label={tDynLoose(t, 'type', enumKey(ct))}
              onRemove={removeFilter}
            />
          ))}
          {filters.owner.map(ownerId => {
            const user = (
              users as Array<{
                id?: string;
                userId?: string;
                name?: string | null;
                email?: string | null;
              }>
            ).find(u => (u.userId ?? u.id) === ownerId);
            return (
              <RemovableFilterBadge
                key={`owner-${ownerId}`}
                filterKey="owner"
                value={ownerId}
                label={user?.name ?? user?.email ?? ownerId}
                onRemove={removeFilter}
              />
            );
          })}
          {filters.billingModel.map(model => (
            <RemovableFilterBadge
              key={`billing-${model}`}
              filterKey="billingModel"
              value={model}
              label={tDynLoose(t, 'billingModel', enumKey(model))}
              onRemove={removeFilter}
            />
          ))}
          {filters.health.map(health => (
            <RemovableFilterBadge
              key={`health-${health}`}
              filterKey="health"
              value={health}
              label={tDynLoose(t, 'health', enumKey(health))}
              onRemove={removeFilter}
            />
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            onClick={clearAllFilters}>
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface LifecycleChipRowProps {
  chipKey: (typeof LIFECYCLE_STAGE_CHIPS)[number]['key'];
  label: string;
  checked: boolean;
  onToggle: (key: keyof FilterState, value: string) => void;
}

const LifecycleChipRow = memo(function LifecycleChipRow({
  chipKey,
  label,
  checked,
  onToggle,
}: LifecycleChipRowProps) {
  const handleChange = useCallback(() => onToggle('lifecycleStage', chipKey), [onToggle, chipKey]);
  return (
    <label
      htmlFor={`lifecycle-${chipKey}`}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox id={`lifecycle-${chipKey}`} checked={checked} onCheckedChange={handleChange} />
      <span>{label}</span>
    </label>
  );
});

interface FilterOptionRowProps {
  title: string;
  option: { value: string; label: string };
  checked: boolean;
  onToggle: (value: string) => void;
}

const FilterOptionRow = memo(function FilterOptionRow({
  title,
  option,
  checked,
  onToggle,
}: FilterOptionRowProps) {
  const handleChange = useCallback(() => onToggle(option.value), [onToggle, option.value]);
  return (
    <label
      htmlFor={`filter-${title}-${option.value}`}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox
        id={`filter-${title}-${option.value}`}
        checked={checked}
        onCheckedChange={handleChange}
      />
      <span>{option.label}</span>
    </label>
  );
});

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

  // Show selected first, then limit unselected to maxVisible
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
          <FilterOptionRow
            key={option.value}
            title={title}
            option={option}
            checked={selected.includes(option.value)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

interface RemovableFilterBadgeProps {
  filterKey: keyof FilterState;
  value: string;
  label: string;
  onRemove: (key: keyof FilterState, value: string) => void;
}

const RemovableFilterBadge = memo(function RemovableFilterBadge({
  filterKey,
  value,
  label,
  onRemove,
}: RemovableFilterBadgeProps) {
  const tAria = useTranslations('Common.aria');
  const handleRemove = useCallback(() => onRemove(filterKey, value), [onRemove, filterKey, value]);
  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={handleRemove}
        aria-label={tAria('removeFilter', { label })}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
});
