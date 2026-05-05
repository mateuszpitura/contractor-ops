import type { ReactNode } from 'react';

export interface AtelierToolbarProps {
  /** Search input + any inline filter chips. */
  search?: ReactNode;
  /** Filter controls (selects, date pickers, segmented). */
  filters?: ReactNode;
  /** Right-aligned actions (bulk operations, export, primary CTA). */
  actions?: ReactNode;
  /**
   * When set, the toolbar sticks to the top of its scroll container.
   * Useful for tables that scroll under it. Default false.
   */
  sticky?: boolean;
  /**
   * Optional bottom row for active filter chips / selection summary.
   * Hidden when undefined.
   */
  footer?: ReactNode;
}

/**
 * Workbench toolbar — three-slot layout (search | filters | actions)
 * with an optional footer for filter chips or selection summaries.
 *
 * Workbench-tier discipline: solid surface (--surface-1), no glass
 * blur, no shimmer. Sticky positioning is opt-in to avoid surprise
 * z-index conflicts with dialogs.
 */
export function AtelierToolbar({
  search,
  filters,
  actions,
  sticky = false,
  footer,
}: AtelierToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-3 ${
        sticky ? 'sticky top-14 z-20' : ''
      }`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        {search ? <div className="min-w-0 lg:flex-1">{search}</div> : null}
        {filters ? (
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">{filters}</div>
        ) : null}
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 lg:ms-auto">{actions}</div>
        ) : null}
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
