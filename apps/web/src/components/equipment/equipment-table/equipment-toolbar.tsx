'use client';

import { Filter, Loader2, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  onAddEquipment,
}: EquipmentToolbarProps) {
  const t = useTranslations('Equipment');

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

  // Active filter count
  const activeFilterCount = filters.type.length + filters.status.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    onFiltersChange({ type: [], status: [] });
  };

  const toggleFilterValue = (key: keyof FilterState, value: string) => {
    const current = filters[key];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    onFiltersChange({ [key]: next });
  };

  const removeFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('list.filters.search')}
            value={localSearch}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => handleSearchInput(e.target.value)}
            className="h-9 ps-9 pe-8"
          />
          {!!isSearching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Filters popover */}
        <Popover>
          <PopoverTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="outline" size="lg">
                <Filter className="h-3.5 w-3.5" />
                {t('list.filters.type')}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            )}
          />
          <PopoverContent className="w-72 p-0" align="start">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
              {/* Type filter */}
              <FilterSection
                title={t('list.filters.type')}
                options={EQUIPMENT_TYPES.map(type => ({
                  value: type,
                  label: t(`type.${type}`),
                }))}
                selected={filters.type}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onToggle={value => toggleFilterValue('type', value)}
              />

              {/* Status filter */}
              <FilterSection
                title={t('list.filters.status')}
                options={EQUIPMENT_STATUSES.map(status => ({
                  value: status,
                  label: t(`status.${status}`),
                }))}
                selected={filters.status}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onToggle={value => toggleFilterValue('status', value)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add equipment CTA */}
        <Button size="lg" onClick={onAddEquipment}>
          {t('addEquipment')}
        </Button>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.type.map(type => (
            <FilterBadge
              key={`type-${type}`}
              label={t(`type.${type}` as Parameters<typeof t>[0])}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('type', type)}
            />
          ))}
          {filters.status.map(status => (
            <FilterBadge
              key={`status-${status}`}
              label={t(`status.${status}` as Parameters<typeof t>[0])}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onRemove={() => removeFilter('status', status)}
            />
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={clearAllFilters}>
            Clear all
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
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[13px] font-medium text-foreground">{title}</h4>
      <div className="space-y-1">
        {options.map(option => (
          <label
            key={option.value}
            htmlFor={`equip-filter-${title}-${option.value}`}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Checkbox
              id={`equip-filter-${title}-${option.value}`}
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
  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
