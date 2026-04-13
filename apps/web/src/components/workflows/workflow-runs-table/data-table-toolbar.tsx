'use client';

import { Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  onStartWorkflow: () => void;
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
  onStartWorkflow,
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
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={localSearch}
          onChange={e => handleSearchInput(e.target.value)}
          className="h-9 ps-9 pe-8"
        />
        {!!isSearching && (
          <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Start workflow CTA */}
      <Button size="lg" onClick={onStartWorkflow}>
        {t('startWorkflow')}
      </Button>
    </div>
  );
}
