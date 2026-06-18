/**
 * Static skeleton for the staff dashboard shell.
 *
 * Rendered by `DashboardShellContainer` while the session / org / ToS gate
 * resolves, in place of a centered spinner. Geometry mirrors
 * `dashboard-shell.tsx` (sidebar rail + `h-14` glass topbar + `p-6` main) so
 * the swap to the live shell is seamless — the chrome stays put and only the
 * skeleton placeholders are replaced by real content. The main surface is
 * left empty: page-level loading skeletons land in a later iteration.
 */

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
} from '@contractor-ops/ui/components/shadcn/sidebar';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../i18n/useTranslations.js';

// Approximate per-group nav item counts (overview / operations / finance /
// system) from `lib/navigation.ts`. Exact counts are permission-gated, so a
// representative shape is enough to avoid a layout jump on swap.
const navGroupItemKeys = (groupKey: string, count: number): readonly string[] =>
  Array.from({ length: count }, (_, i) => `${groupKey}-item-${i + 1}`);

const NAV_GROUPS = [
  { key: 'overview', itemKeys: navGroupItemKeys('overview', 1), hasLabel: false },
  { key: 'operations', itemKeys: navGroupItemKeys('operations', 5), hasLabel: true },
  { key: 'finance', itemKeys: navGroupItemKeys('finance', 6), hasLabel: true },
  { key: 'system', itemKeys: navGroupItemKeys('system', 3), hasLabel: true },
] as const;

export function DashboardShellSkeleton() {
  const t = useTranslations('Common');

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex h-12 items-center gap-2 px-2">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {NAV_GROUPS.map(group => (
            <SidebarGroup key={group.key} className={group.key === 'overview' ? 'pb-0' : undefined}>
              {group.hasLabel ? <Skeleton className="mx-2 mb-2 h-3 w-16" /> : null}
              <SidebarMenu>
                {group.itemKeys.map(itemKey => (
                  <SidebarMenuItem key={itemKey}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex h-12 items-center gap-2 px-2">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="glass-subtle sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b-0 px-6">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="ms-2 h-4 w-32" />
          <div className="ms-auto flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>
        <main className="atelier-main-surface flex min-w-0 flex-1 flex-col p-6" aria-busy="true">
          <span className="sr-only" role="status" aria-live="polite">
            {t('loading')}
          </span>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
