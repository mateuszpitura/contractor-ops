import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shared route-level loading primitive.
 *
 * Server Component (no `"use client"`) — Next.js renders this while the
 * sibling `page.tsx` Server Component awaits its data. Matches the dashboard
 * page chrome (page header strip + content grid) so layout shift is minimal
 * once the real page hydrates.
 *
 * `ariaLabel` defaults to a generic "Loading" string; localized callers
 * should pass a translated string so screen readers announce the route
 * being loaded.
 */
export type RouteLoadingProps = {
  /** Route segment label, e.g. `"contracts"`. Surfaced via `data-testid`. */
  routeName: string;
  /** Accessible label for the loading region. Defaults to `"Loading"`. */
  ariaLabel?: string;
};

export function RouteLoading({ routeName, ariaLabel = 'Loading' }: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      data-testid={`route-loading-${routeName}`}
      className="flex flex-col gap-6">
      {/* Page header strip — title + subtitle + action slot */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* KPI / summary row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
            key={`kpi-${index}`}
            className="h-24 w-full"
          />
        ))}
      </div>

      {/* Primary content surface (table / list / detail panel) */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
            key={`row-${index}`}
            className="h-14 w-full"
          />
        ))}
      </div>
    </div>
  );
}
