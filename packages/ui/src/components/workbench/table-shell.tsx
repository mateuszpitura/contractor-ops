'use client';

import type { ReactNode } from 'react';

import { cn } from '../../lib/utils.js';

export interface AtelierTableShellProps {
  children: ReactNode;
  /** Fixed chrome above the scroll region (e.g. column visibility toggle). */
  chrome?: ReactNode;
  /** Whether to render a translucent loading overlay on top of the rows. */
  isLoading?: boolean;
  /** Translucent overlay copy when isLoading. Defaults to nothing visible. */
  loadingLabel?: string;
  /** Optional pagination row rendered below the scroll area. */
  footer?: ReactNode;
  /**
   * When true (default), the shell participates in a flex column and the
   * scroll region grows to fill remaining space (`min-h-0 flex-1`) with
   * internal overflow and a sticky column header. Set false for dialogs
   * or compact embeds.
   */
  constrainHeight?: boolean;
  className?: string;
}

/**
 * Workbench-tier table shell. Wraps a `<table>` (or any tabular layout)
 * with consistent chrome: rounded border, flex-fill scroll, sticky column
 * headers, and an optional loading overlay that doesn't shift layout.
 *
 * **Viewport discipline:** height is driven by CSS flex (`min-h-0 flex-1`)
 * from the dashboard shell down — not by scroll-triggered JS measurement.
 * Parent chain must include `flex min-h-0 flex-1 flex-col` (see
 * `WORKBENCH_*_CLASS` helpers in `table-page-layout.ts`).
 */
export function AtelierTableShell({
  children,
  chrome,
  isLoading = false,
  loadingLabel,
  footer,
  constrainHeight = true,
  className,
}: AtelierTableShellProps) {
  return (
    <div className={cn('flex flex-col gap-2', constrainHeight && 'min-h-0 flex-1', className)}>
      <div
        className={cn(
          'relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card',
          // No min-h-[320px] floor — that forced the bordered box to push its
          // footer below the parent flex slot on pages where the table region
          // had < 320 px of vertical room (e.g. /invoices, where the
          // pre-table compliance summary + filter chips + upload area eat the
          // page's height budget). The inner [role=region] keeps its own
          // overflow-auto so short content still renders without ugly collapse.
          constrainHeight && 'min-h-0 max-h-max flex-1',
        )}>
        {chrome ? (
          <div className="shrink-0 border-b border-border/50 bg-muted/40">{chrome}</div>
        ) : null}
        <div
          role="region"
          aria-label="Table content"
          className={cn(
            'overflow-auto [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            '[&_[data-slot=table-container]]:overflow-visible',
            '[&_[data-slot=table-header]]:bg-transparent [&_[data-slot=table-header]>tr>th]:border-b-0',
            '[&_[data-slot=table-head]]:sticky [&_[data-slot=table-head]]:top-0 [&_[data-slot=table-head]]:z-10',
            '[&_[data-slot=table-head]]:bg-muted [&_[data-slot=table-head]]:shadow-[0_1px_0_0_hsl(var(--border)/0.5)]',
            constrainHeight && 'min-h-0 flex-1',
          )}>
          {children}
        </div>
        {isLoading ? (
          <div
            aria-busy="true"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-background/60">
            {loadingLabel ? (
              <span className="text-xs font-medium text-muted-foreground">{loadingLabel}</span>
            ) : (
              <span className="sr-only">Loading</span>
            )}
          </div>
        ) : null}
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-between gap-3">{footer}</div>
      ) : null}
    </div>
  );
}
