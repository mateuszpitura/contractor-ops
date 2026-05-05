import type { ReactNode } from 'react';

export interface AtelierTableShellProps {
  children: ReactNode;
  /** Whether to render a translucent loading overlay on top of the rows. */
  isLoading?: boolean;
  /** Translucent overlay copy when isLoading. Defaults to nothing visible. */
  loadingLabel?: string;
  /** Optional pagination row rendered below the scroll area. */
  footer?: ReactNode;
}

/**
 * Workbench-tier table shell. Wraps a `<table>` (or any tabular layout)
 * with consistent chrome: rounded border, sticky-header support via
 * caller's <thead> position:sticky, and an optional loading overlay
 * that doesn't shift layout.
 *
 * **Workbench discipline (§3.3):** no backdrop-filter, no per-row
 * tilt, no per-row shimmer, no per-row glass. The overlay uses
 * solid --background with an opacity, not glass.
 *
 * The shell does NOT render the table itself — the caller controls
 * <table>/<thead>/<tbody>/<tr>/<td>. This keeps the primitive
 * compatible with @tanstack/react-table render functions.
 */
export function AtelierTableShell({
  children,
  isLoading = false,
  loadingLabel,
  footer,
}: AtelierTableShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card">
        <div className="overflow-x-auto">{children}</div>
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
      {footer ? <div className="flex items-center justify-between gap-3">{footer}</div> : null}
    </div>
  );
}
