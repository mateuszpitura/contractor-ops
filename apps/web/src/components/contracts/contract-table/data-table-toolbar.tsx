'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Plus, Search, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTableFilters } from './data-table-filters';

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

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  isSearching?: boolean;
  /** Disable all interactive controls (initial data load). */
  disabled?: boolean;
  onNewContract: () => void;
  onImport?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar with search input, filter popover, active filter badges,
 * and "New contract" CTA button.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  isSearching,
  disabled: filtersDisabled,
  onNewContract,
  onImport,
}: DataTableToolbarProps) {
  const t = useTranslations('Contracts');

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

  return (
    <div className="space-y-2">
      {/* Main toolbar row */}
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

        {/* Filters */}
        <DataTableFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          disabled={filtersDisabled}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Import CTA */}
        {!!onImport && (
          <Button size="lg" variant="outline" disabled={filtersDisabled} onClick={onImport}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t('import')}
          </Button>
        )}

        {/* New contract CTA */}
        <Button size="lg" disabled={filtersDisabled} onClick={onNewContract}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('newContract')}
        </Button>
      </div>
    </div>
  );
}
