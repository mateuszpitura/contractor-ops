import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

interface ApprovalQueueToolbarProps {
  activeStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', labelKey: 'chips.pending' },
  { value: 'OVERDUE', labelKey: 'chips.overdue' },
  { value: 'APPROVED', labelKey: 'chips.approved' },
  { value: 'REJECTED', labelKey: 'chips.rejected' },
] as const;

export function ApprovalQueueToolbar({
  activeStatuses,
  onStatusChange,
  search,
  onSearchChange,
  isSearching,
  isLoading,
}: ApprovalQueueToolbarProps) {
  const t = useTranslations('Approvals');
  const tAria = useTranslations('Common.aria');
  const reactId = useId();

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

  const toggleFilter = useCallback(
    (value: string) => {
      if (activeStatuses.includes(value)) {
        onStatusChange(activeStatuses.filter(s => s !== value));
      } else {
        onStatusChange([...activeStatuses, value]);
      }
    },
    [activeStatuses, onStatusChange],
  );

  const removeFilter = useCallback(
    (value: string) => {
      onStatusChange(activeStatuses.filter(s => s !== value));
    },
    [activeStatuses, onStatusChange],
  );

  const clearAllFilters = useCallback(() => {
    onStatusChange([]);
  }, [onStatusChange]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleSearchInput(e.target.value),
    [handleSearchInput],
  );

  const renderStatusTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="lg" disabled={isLoading}>
        {t('columns.status')}
        {activeStatuses.length > 0 && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {activeStatuses.length}
          </Badge>
        )}
      </Button>
    ),
    [activeStatuses.length, isLoading, t],
  );

  const activeFilterCount = activeStatuses.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={localSearch}
            disabled={isLoading}
            onChange={handleSearchChange}
            className="h-9 ps-9 pe-8"
          />
          {!!isSearching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <Popover>
          <PopoverTrigger render={renderStatusTrigger} />
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-4 space-y-2">
              <h4 className="text-[13px] font-medium text-foreground">{t('columns.status')}</h4>
              <div className="space-y-1">
                {STATUS_OPTIONS.map(option => (
                  <StatusFilterRow
                    key={option.value}
                    id={`${reactId}-filter-${option.value}`}
                    value={option.value}
                    checked={activeStatuses.includes(option.value)}
                    label={t(option.labelKey)}
                    onToggle={toggleFilter}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeStatuses.map(s => (
            <ActiveStatusBadge
              key={s}
              value={s}
              label={tDynLoose(t, 'chips', s.toLowerCase())}
              removeLabel={tAria('removeFilter', {
                label: tDynLoose(t, 'chips', s.toLowerCase()),
              })}
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

function StatusFilterRow({
  id,
  value,
  checked,
  label,
  onToggle,
}: {
  id: string;
  value: string;
  checked: boolean;
  label: string;
  onToggle: (value: string) => void;
}) {
  const handleChange = useCallback(() => onToggle(value), [onToggle, value]);
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox id={id} checked={checked} onCheckedChange={handleChange} />
      <span>{label}</span>
    </label>
  );
}

function ActiveStatusBadge({
  value,
  label,
  removeLabel,
  onRemove,
}: {
  value: string;
  label: string;
  removeLabel: string;
  onRemove: (value: string) => void;
}) {
  const handleClick = useCallback(() => onRemove(value), [onRemove, value]);
  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
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
