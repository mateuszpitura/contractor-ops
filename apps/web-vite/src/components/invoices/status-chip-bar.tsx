/**
 * Status chip bar.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { tabsListVariants } from '@contractor-ops/ui/components/shadcn/tabs';
import { memo, useCallback, useMemo } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';

interface StatusChipBarProps {
  activeStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  disabled?: boolean;
  counts?: Record<string, number>;
}

const STATUS_TOGGLES = [
  { key: 'RECEIVED', labelKey: 'chips.received' },
  { key: 'MATCHED', labelKey: 'chips.matched' },
  { key: 'UNMATCHED', labelKey: 'chips.unmatched' },
  { key: 'DISCREPANCY', labelKey: 'chips.discrepancy' },
  { key: 'APPROVAL_PENDING', labelKey: 'chips.pendingApproval' },
  { key: 'APPROVED', labelKey: 'chips.approved' },
  { key: 'READY_FOR_PAYMENT', labelKey: 'chips.readyForPayment' },
] as const;

const TRIGGER_BASE = cn(
  'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-0.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 ease-out',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring',
  'disabled:pointer-events-none disabled:opacity-50',
  'text-muted-foreground hover:text-foreground/80',
);

const TRIGGER_ACTIVE = 'bg-background text-foreground shadow-sm';

export function StatusChipBarSkeleton() {
  return (
    <div className="flex items-center gap-2 pb-1">
      {STATUS_TOGGLES.map(toggle => (
        <Skeleton key={toggle.key} className="h-9 w-24 rounded-lg" />
      ))}
    </div>
  );
}

interface StatusChipButtonProps {
  toggleKey: string;
  label: string;
  count: number;
  isActive: boolean;
  disabled?: boolean;
  onToggle: (key: string) => void;
}

const StatusChipButton = memo(function StatusChipButton({
  toggleKey,
  label,
  count,
  isActive,
  disabled,
  onToggle,
}: StatusChipButtonProps) {
  const handleClick = useCallback(() => {
    onToggle(toggleKey);
  }, [onToggle, toggleKey]);

  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      aria-checked={isActive}
      onClick={handleClick}
      className={cn(TRIGGER_BASE, isActive && TRIGGER_ACTIVE)}>
      {label}
      <span className="tabular-nums text-muted-foreground">({count})</span>
    </button>
  );
});

export function StatusChipBar({
  activeStatuses,
  onStatusChange,
  disabled,
  counts = {},
}: StatusChipBarProps) {
  const t = useTranslations('Invoices');

  const activeSet = useMemo(() => new Set(activeStatuses), [activeStatuses]);

  const getCount = (key: string): number => {
    return (counts[`status:${key}`] ?? 0) + (counts[`matchStatus:${key}`] ?? 0);
  };

  const handleToggle = useCallback(
    (key: string) => {
      if (activeSet.has(key)) {
        onStatusChange(activeStatuses.filter(s => s !== key));
      } else {
        onStatusChange([...activeStatuses, key]);
      }
    },
    [activeSet, activeStatuses, onStatusChange],
  );

  return (
    <fieldset
      className={cn(tabsListVariants({ variant: 'default' }), 'h-9 border-0 p-1')}
      aria-label={t('filters')}>
      {STATUS_TOGGLES.map(toggle => (
        <StatusChipButton
          key={toggle.key}
          toggleKey={toggle.key}
          label={t(toggle.labelKey)}
          count={getCount(toggle.key)}
          isActive={activeSet.has(toggle.key)}
          disabled={disabled}
          onToggle={handleToggle}
        />
      ))}
    </fieldset>
  );
}
