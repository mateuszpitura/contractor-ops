import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterState {
  type: string[];
  status: string[];
}

interface EquipmentToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  isSearching?: boolean;
  /** Disable all interactive controls (initial data load). */
  disabled?: boolean;
  onAddEquipment: () => void;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const EQUIPMENT_TYPES = [
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'HEADSET',
  'KEYBOARD',
  'MOUSE',
  'OTHER',
] as const;

const EQUIPMENT_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'RETURN_REQUESTED',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'RETIRED',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar with search input, filter popover, and add button for equipment table.
 */
export function EquipmentToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  isSearching,
  disabled: filtersDisabled,
  onAddEquipment,
}: EquipmentToolbarProps) {
  const t = useTranslations('Equipment');

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

  const activeFilterCount = filters.type.length + filters.status.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    onFiltersChange({ type: [], status: [] });
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

  const renderTypeFilterTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
        {t('list.filters.type')}
        {filters.type.length > 0 && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {filters.type.length}
          </Badge>
        )}
      </Button>
    ),
    [filtersDisabled, filters.type.length, t],
  );

  const renderStatusFilterTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
        {t('list.filters.status')}
        {filters.status.length > 0 && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {filters.status.length}
          </Badge>
        )}
      </Button>
    ),
    [filtersDisabled, filters.status.length, t],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('list.filters.search')}
            aria-label={t('list.filters.search')}
            value={localSearch}
            disabled={filtersDisabled}
            onChange={handleSearchChange}
            className="h-9 ps-9 pe-8"
          />
          {!!isSearching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <Popover>
          <PopoverTrigger render={renderTypeFilterTrigger} />
          <PopoverContent className="w-52 p-0" align="start">
            <div className="space-y-2 p-4">
              <h4 className="text-[13px] font-medium text-foreground">{t('list.filters.type')}</h4>
              <div className="space-y-1">
                {EQUIPMENT_TYPES.map(type => (
                  <FilterCheckboxRow
                    key={type}
                    id={`equip-type-${type}`}
                    filterKey="type"
                    value={type}
                    checked={filters.type.includes(type)}
                    label={tDynLoose(t, 'type', enumKey(type))}
                    onToggle={toggleFilterValue}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger render={renderStatusFilterTrigger} />
          <PopoverContent className="w-52 p-0" align="start">
            <div className="space-y-2 p-4">
              <h4 className="text-[13px] font-medium text-foreground">
                {t('list.filters.status')}
              </h4>
              <div className="space-y-1">
                {EQUIPMENT_STATUSES.map(status => (
                  <FilterCheckboxRow
                    key={status}
                    id={`equip-status-${status}`}
                    filterKey="status"
                    value={status}
                    checked={filters.status.includes(status)}
                    label={tDynLoose(t, 'status', enumKey(status))}
                    onToggle={toggleFilterValue}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <Button size="lg" disabled={filtersDisabled} onClick={onAddEquipment}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addEquipment')}
        </Button>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.type.map(type => (
            <ActiveFilterBadge
              key={`type-${type}`}
              filterKey="type"
              value={type}
              label={tDynLoose(t, 'type', enumKey(type))}
              removeLabel={t('list.filters.removeFilter', {
                label: tDynLoose(t, 'type', enumKey(type)),
              })}
              onRemove={removeFilter}
            />
          ))}
          {filters.status.map(status => (
            <ActiveFilterBadge
              key={`status-${status}`}
              filterKey="status"
              value={status}
              label={tDynLoose(t, 'status', enumKey(status))}
              removeLabel={t('list.filters.removeFilter', {
                label: tDynLoose(t, 'status', enumKey(status)),
              })}
              onRemove={removeFilter}
            />
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground underline hover:text-foreground"
            onClick={clearAllFilters}>
            {t('list.filters.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterCheckboxRow({
  id,
  filterKey,
  value,
  checked,
  label,
  onToggle,
}: {
  id: string;
  filterKey: keyof FilterState;
  value: string;
  checked: boolean;
  label: string;
  onToggle: (key: keyof FilterState, value: string) => void;
}) {
  const handleChange = useCallback(() => onToggle(filterKey, value), [onToggle, filterKey, value]);
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox id={id} checked={checked} onCheckedChange={handleChange} />
      <span>{label}</span>
    </label>
  );
}

function ActiveFilterBadge({
  filterKey,
  value,
  label,
  removeLabel,
  onRemove,
}: {
  filterKey: keyof FilterState;
  value: string;
  label: string;
  removeLabel: string;
  onRemove: (key: keyof FilterState, value: string) => void;
}) {
  const handleClick = useCallback(() => onRemove(filterKey, value), [onRemove, filterKey, value]);
  return (
    <Badge variant="secondary" className="gap-1 py-0.5 ps-2 pe-1">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={handleClick}
        aria-label={removeLabel}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
