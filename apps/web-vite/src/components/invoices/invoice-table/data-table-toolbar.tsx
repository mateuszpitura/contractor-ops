import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Search, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DataTableFilters } from './data-table-filters.js';

interface FilterState {
  status: string[];
  matchStatus: string[];
  source: string[];
}

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  isSearching?: boolean;
  disabled?: boolean;
  onUpload: () => void;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  isSearching,
  disabled: filtersDisabled,
  onUpload,
}: DataTableToolbarProps) {
  const t = useTranslations('Invoices');

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

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleSearchInput(event.target.value);
    },
    [handleSearchInput],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
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

        <DataTableFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          disabled={filtersDisabled}
        />

        <div className="flex-1" />

        <Button size="lg" disabled={filtersDisabled} onClick={onUpload}>
          <Upload className="h-3.5 w-3.5" />
          {t('uploadInvoices')}
        </Button>
      </div>
    </div>
  );
}
