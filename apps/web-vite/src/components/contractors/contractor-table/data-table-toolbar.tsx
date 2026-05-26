import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Filter, Loader2, Plus, Search, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ContractorListToolbarProps } from '../hooks/use-contractor-list.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterState {
  status: string[];
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

const CONTRACTOR_TYPES = ['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER'] as const;

const BILLING_MODELS = ['FIXED', 'HOURLY', 'PROJECT', 'MILESTONE'] as const;

const HEALTH_OPTIONS = ['green', 'yellow', 'red'] as const;

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

  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      lifecycleStage: [],
      type: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
    });
  };

  const toggleFilterValue = (key: keyof FilterState, value: string) => {
    const current = filters[key];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    onFiltersChange({ [key]: next });
  };

  const removeFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
  };

  // Secondary filters (everything except lifecycleStage which is now the chip bar)
  const secondaryFilterCount =
    filters.status.length +
    filters.type.length +
    filters.owner.length +
    filters.team.length +
    filters.billingModel.length +
    filters.health.length;
  const hasSecondaryFilters = secondaryFilterCount > 0;

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
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => handleSearchInput(e.target.value)}
            className="h-9 ps-9 pe-8"
          />
          {!!isSearching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Status multi-select */}
        <Popover>
          <PopoverTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
                {t('columns.lifecycleStage')}
                {filters.lifecycleStage.length > 0 && (
                  <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                    {filters.lifecycleStage.length}
                  </Badge>
                )}
              </Button>
            )}
          />
          <PopoverContent className="w-52 p-0" align="start">
            <div className="p-4 space-y-2">
              <h4 className="text-[13px] font-medium text-foreground">
                {t('columns.lifecycleStage')}
              </h4>
              <div className="space-y-1">
                {LIFECYCLE_STAGE_CHIPS.map(chip => (
                  <label
                    key={chip.key}
                    htmlFor={`lifecycle-${chip.key}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                    <Checkbox
                      id={`lifecycle-${chip.key}`}
                      checked={filters.lifecycleStage.includes(chip.key)}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                      onCheckedChange={() => toggleFilterValue('lifecycleStage', chip.key)}
                    />
                    <span>{t(chip.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Advanced filters popover (no lifecycle — that lives in chip bar) */}
        <Popover>
          <PopoverTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
                <Filter className="h-3.5 w-3.5" />
                {t('filters')}
                {hasSecondaryFilters && (
                  <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                    {secondaryFilterCount}
                  </Badge>
                )}
              </Button>
            )}
          />
          <PopoverContent className="w-72 p-0" align="start">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
              {/* Type */}
              <FilterSection
                title={t('columns.type')}
                options={CONTRACTOR_TYPES.map(ct => ({
                  value: ct,
                  label: tDynLoose(t, 'type', enumKey(ct)),
                }))}
                selected={filters.type}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onToggle={value => toggleFilterValue('type', value)}
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
                selected={filters.owner}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onToggle={value => toggleFilterValue('owner', value)}
                searchable
              />

              {/* Billing model */}
              <FilterSection
                title={t('columns.billingModel')}
                options={BILLING_MODELS.map(model => ({
                  value: model,
                  label: tDynLoose(t, 'billingModel', enumKey(model)),
                }))}
                selected={filters.billingModel}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onToggle={value => toggleFilterValue('billingModel', value)}
              />

              {/* Compliance health */}
              <FilterSection
                title={t('columns.health')}
                options={HEALTH_OPTIONS.map(health => ({
                  value: health,
                  label: tDynLoose(t, 'health', enumKey(health)),
                }))}
                selected={filters.health}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onToggle={value => toggleFilterValue('health', value)}
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

      {/* Active filter badges (lifecycle handled by chip bar, so skipped here) */}
      {hasSecondaryFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.type.map(ct => (
            <FilterBadge
              key={`type-${ct}`}
              label={tDynLoose(t, 'type', enumKey(ct))}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('type', ct)}
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
              <FilterBadge
                key={`owner-${ownerId}`}
                label={user?.name ?? user?.email ?? ownerId}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onRemove={() => removeFilter('owner', ownerId)}
              />
            );
          })}
          {filters.billingModel.map(model => (
            <FilterBadge
              key={`billing-${model}`}
              label={tDynLoose(t, 'billingModel', enumKey(model))}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('billingModel', model)}
            />
          ))}
          {filters.health.map(health => (
            <FilterBadge
              key={`health-${health}`}
              label={tDynLoose(t, 'health', enumKey(health))}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('health', health)}
            />
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
            htmlFor={`filter-${title}-${option.value}`}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Checkbox
              id={`filter-${title}-${option.value}`}
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
