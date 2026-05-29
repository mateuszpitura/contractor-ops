import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  disabled?: boolean;
  onStartWorkflow: () => void;
  filterTrigger?: React.ReactNode;
  filterBadges?: React.ReactNode;
}

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
    (e: React.ChangeEvent<HTMLInputElement>) => handleSearchInput(e.target.value),
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

        {filterTrigger}

        <div className="flex-1" />

        <Button size="lg" disabled={filtersDisabled} onClick={onStartWorkflow}>
          {t('startWorkflow')}
        </Button>
      </div>
      {filterBadges}
    </div>
  );
}
