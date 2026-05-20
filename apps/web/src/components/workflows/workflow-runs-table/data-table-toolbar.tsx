'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  /** Disable all interactive controls (initial data load). */
  disabled?: boolean;
  onStartWorkflow: () => void;
  /** Filter popover button rendered inline next to search. */
  filterTrigger?: React.ReactNode;
  /** Active filter badges rendered below the main toolbar row. */
  filterBadges?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar with search input and "Start workflow" CTA button.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  isSearching,
  disabled: filtersDisabled,
  onStartWorkflow,
  filterTrigger,
  filterBadges,
}: DataTableToolbarProps) {
  const t = useTranslations('Workflows');

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

        {/* Filter trigger */}
        {filterTrigger}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Start workflow CTA */}
        <Button size="lg" disabled={filtersDisabled} onClick={onStartWorkflow}>
          {t('startWorkflow')}
        </Button>
      </div>
      {filterBadges}
    </div>
  );
}
