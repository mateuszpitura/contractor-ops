'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { tabsListVariants } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusChipBarProps {
  /** Currently active status filters from URL state (array for multi-select) */
  activeStatuses: string[];
  /** Callback to set the active status filters */
  onStatusChange: (statuses: string[]) => void;
  /** Disable all toggles (initial data load). */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Toggle definitions
// ---------------------------------------------------------------------------

const STATUS_TOGGLES = [
  { key: 'RECEIVED', labelKey: 'chips.received' },
  { key: 'MATCHED', labelKey: 'chips.matched' },
  { key: 'UNMATCHED', labelKey: 'chips.unmatched' },
  { key: 'DISCREPANCY', labelKey: 'chips.discrepancy' },
  { key: 'APPROVAL_PENDING', labelKey: 'chips.pendingApproval' },
  { key: 'APPROVED', labelKey: 'chips.approved' },
  { key: 'READY_FOR_PAYMENT', labelKey: 'chips.readyForPayment' },
] as const;

// ---------------------------------------------------------------------------
// Shared trigger classes — mirrors TabsTrigger default-variant styles so
// single-select Tabs (row 1) and multi-select toggles (row 2) look identical.
// ---------------------------------------------------------------------------

const TRIGGER_BASE = cn(
  'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-0.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 ease-out',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring',
  'disabled:pointer-events-none disabled:opacity-50',
  'text-muted-foreground hover:text-foreground/80',
);

const TRIGGER_ACTIVE = 'bg-background text-foreground shadow-sm';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Multi-select toggle bar for invoice payment & matching status.
 * Visually matches `TabsList` / `TabsTrigger` (default variant) but allows
 * multiple items to be pressed simultaneously. Empty selection = no filter.
 */
export function StatusChipBar({ activeStatuses, onStatusChange, disabled }: StatusChipBarProps) {
  const t = useTranslations('Invoices');

  // Fetch live counts
  const countsQuery = useQuery(trpc.invoice.statusCounts.queryOptions());
  const counts = (countsQuery.data ?? {}) as Record<string, number>;

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

  if (countsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 pb-1">
        {STATUS_TOGGLES.map(toggle => (
          <Skeleton key={toggle.key} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <fieldset
      className={cn(tabsListVariants({ variant: 'default' }), 'h-9 border-0 p-1')}
      aria-label={t('filters')}>
      {STATUS_TOGGLES.map(toggle => {
        const isActive = activeSet.has(toggle.key);
        const count = getCount(toggle.key);

        return (
          <button
            key={toggle.key}
            type="button"
            role="switch"
            disabled={disabled}
            aria-checked={isActive}
            // biome-ignore lint/nursery/noJsxPropsBind: per-toggle handler
            onClick={() => handleToggle(toggle.key)}
            className={cn(TRIGGER_BASE, isActive && TRIGGER_ACTIVE)}>
            {t(toggle.labelKey as Parameters<typeof t>[0])}
            <span className="tabular-nums text-muted-foreground">({count})</span>
          </button>
        );
      })}
    </fieldset>
  );
}
