'use client';

import type { ReactNode } from 'react';

import { cn } from '../../lib/utils.js';
import { WORKBENCH_TABLE_BODY_MAX_HEIGHT_CLASS } from './table-page-layout.js';

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
   * Height behaviour switch. When false, the shell renders full content height
   * with no cap/fill (dialogs, compact embeds). When true (default), the body
   * region's height is managed — see {@link fill}.
   */
  constrainHeight?: boolean;
  /**
   * Body height mode (only when `constrainHeight`).
   * - `false` (default): **cap** — body capped at
   *   {@link WORKBENCH_TABLE_BODY_MAX_HEIGHT_CLASS} (300px), scrolls
   *   internally, card is content-height; the *page* scrolls. Use on pages
   *   with pre-table chrome (filters, summary tiles) — e.g. invoices.
   * - `true`: **fill** — the shell joins the viewport flex chain and the body
   *   grows to fill remaining space, scrolling internally; the page does not
   *   scroll. Use on table-only pages — e.g. contractors. Pair with
   *   `WORKBENCH_TABLE_PAGE_FILL_CLASS` on the page root.
   */
  fill?: boolean;
  className?: string;
}

/**
 * Workbench-tier table shell. Wraps a `<table>` (or any tabular layout)
 * with consistent chrome: rounded border, sticky column headers, an optional
 * pagination footer, and a loading overlay that doesn't shift layout.
 *
 * **Height model:** see {@link AtelierTableShellProps.fill}. Cap mode (default)
 * keeps the card content-height with a 300px scroll body so the page scrolls;
 * fill mode grows the body to fill the viewport so the table — not the page —
 * scrolls. Fill mode requires the viewport flex chain (`WORKBENCH_*_FILL`
 * classes in `table-page-layout.ts`).
 */
export function AtelierTableShell({
  children,
  chrome,
  isLoading = false,
  loadingLabel,
  footer,
  constrainHeight = true,
  fill = false,
  className,
}: AtelierTableShellProps) {
  const managed = constrainHeight;
  // Fill mode grows into the viewport slot (flex-1) but `max-h-max` caps it at
  // content height, so few-row tables shrink instead of leaving empty space and
  // the page region is only as tall as it needs to be. Many rows → grows to the
  // slot and the inner region scrolls.
  const fillBox = 'min-h-0 max-h-max flex-1';
  return (
    <div className={cn('flex flex-col gap-2', managed && fill && fillBox, className)}>
      <div
        className={cn(
          'relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card',
          // Fill mode: grow-to-content into the viewport slot so the inner
          // region scrolls. Cap mode: content-height card (no flex-1) so the
          // body's max-height bounds it and the page scrolls instead.
          managed && fill && fillBox,
        )}>
        {chrome ? (
          <div className="shrink-0 border-b border-border/50 bg-muted/40">{chrome}</div>
        ) : null}
        <section
          aria-label="Table content"
          className={cn(
            'overflow-auto [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            '[&_[data-slot=table-container]]:overflow-visible',
            '[&_[data-slot=table-header]]:bg-transparent [&_[data-slot=table-header]>tr>th]:border-b-0',
            '[&_[data-slot=table-head]]:sticky [&_[data-slot=table-head]]:top-0 [&_[data-slot=table-head]]:z-10',
            '[&_[data-slot=table-head]]:bg-muted [&_[data-slot=table-head]]:shadow-[0_1px_0_0_hsl(var(--border)/0.5)]',
            // min-h-0 lets the flex-item region honour its height bound
            // (otherwise min-height:auto = content size wins). Fill grows to the
            // viewport slot; cap clamps at 300px. Both scroll internally.
            managed && cn('min-h-0', fill ? 'flex-1' : WORKBENCH_TABLE_BODY_MAX_HEIGHT_CLASS),
          )}>
          {children}
        </section>
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
