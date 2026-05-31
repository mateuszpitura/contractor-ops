/**
 * Static skeleton for the contractor portal shell.
 *
 * Rendered by `PortalShellContainer` while the portal session query resolves,
 * in place of a centered spinner. Geometry mirrors `portal-shell.tsx` +
 * `portal-top-bar.tsx` (`h-14` `bordered-b bg-card` top bar, centered
 * `max-w-[1200px]` `p-6` main) so the swap to the live shell is seamless. The
 * main surface is left empty: page-level loading skeletons land later.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../i18n/useTranslations.js';

export function PortalShellSkeleton() {
  const t = useTranslations('Common');

  return (
    <div className="flex min-h-svh flex-col bg-background" aria-busy="true">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4">
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={`portal-nav-${i}`} className="h-4 w-16" />
            ))}
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col p-6">
          <span className="sr-only" role="status" aria-live="polite">
            {t('loading')}
          </span>
        </div>
      </main>
    </div>
  );
}
