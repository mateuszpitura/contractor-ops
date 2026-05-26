'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/utils.js';
import { Button } from '../shadcn/button.js';
import type { DensityToggleProps } from './density-toggle.js';
import { DensityToggle } from './density-toggle.js';

export interface TableChromeProps {
  /** Total row count returned by the server query. */
  totalCount: number;
  /**
   * Pluralized entity label rendered after the count, fully localized by
   * the caller (e.g. `"contractors"` / `"kontrahenci"`). The component
   * does not own pluralization rules.
   */
  entityLabel: string;
  /** When true, renders the clear-filters chip. */
  hasActiveFilters?: boolean;
  /**
   * Pre-formatted localized label for the clear-filters chip (e.g.
   * `"Clear 3 filters"`). Caller owns plural rules.
   */
  clearFiltersLabel?: string;
  /** Called when the user clicks the clear-filters chip. */
  onClearFilters?: () => void;
  /**
   * Custom slot rendered on the right side, after the density toggle.
   * Typical content: column visibility dropdown.
   */
  rightSlot?: ReactNode;
  /** When true, hides the density toggle (e.g. embedded compact tables). */
  hideDensityToggle?: boolean;
  /** Translated labels for the density toggle accessible name. */
  densityLabels?: DensityToggleProps['labels'];
  className?: string;
}

/**
 * Workbench-tier meta bar rendered above the table viewport. Pairs with
 * `AtelierTableShell`'s `chrome` slot.
 *
 * Anatomy:
 *   [count · entityLabel · clear-filters?]                  [density] [rightSlot]
 *
 * Visual: solid `bg-muted/40` strip applied by the shell wrapper so the
 * chrome reads as part of the table header band but slightly lighter
 * than the sticky `<thead>` (`bg-muted`).
 */
export function TableChrome({
  totalCount,
  entityLabel,
  hasActiveFilters = false,
  clearFiltersLabel,
  onClearFilters,
  rightSlot,
  hideDensityToggle = false,
  densityLabels,
  className,
}: TableChromeProps) {
  const showClear = hasActiveFilters && typeof onClearFilters === 'function';

  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-1.5', className)}>
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">
          {totalCount.toLocaleString()}
        </span>
        <span className="truncate">{entityLabel}</span>
        {showClear ? (
          <>
            <span aria-hidden className="text-border">
              ·
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-6 gap-1 px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary">
              <X className="h-3 w-3" />
              {clearFiltersLabel ?? 'Clear filters'}
            </Button>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {hideDensityToggle ? null : <DensityToggle labels={densityLabels} />}
        {rightSlot}
      </div>
    </div>
  );
}
