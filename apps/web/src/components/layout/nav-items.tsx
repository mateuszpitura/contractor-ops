'use client';

import { useQuery } from '@tanstack/react-query';
import { Pin } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo } from 'react';
import { useFlagBag } from '@/components/layout/feature-flag-context';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { WorkflowNavBadge } from '@/components/workflows/workflow-nav-badge';
import { usePermissions } from '@/hooks/use-permissions';
import { Link, usePathname } from '@/i18n/navigation';
import type { NavItem } from '@/lib/navigation';
import { navigationGroups } from '@/lib/navigation';
import type { SettingsTabDef, SettingsTabKey } from '@/lib/settings-tabs';
import {
  getSettingsTabHref,
  isRoutedSettingsTab,
  isSettingsTabKey,
  SETTINGS_TABS,
} from '@/lib/settings-tabs';
import { trpc } from '@/trpc/init';
import { tDyn } from '@/i18n/typed-keys';

const PIN_KIND = 'settings-tab' as const;

function settingsTabFromSearch(searchParams: ReturnType<typeof useSearchParams>): string {
  return searchParams.get('tab') ?? 'general';
}

/**
 * Sidebar active state must consider `?tab=` on /settings — usePathname() has no query string,
 * so hrefs like `/settings?tab=integrations` never matched and plain `/settings` always won.
 *
 * Special-case handlers per nav key are dispatched via a lookup map to reduce branching.
 */
type ActiveChecker = (
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  basePath: string,
) => boolean;

/**
 * When the user is on `/settings?tab=<key>` and that key is currently pinned,
 * the pinned entry owns the active state — the parent Settings entry must NOT
 * also light up. The pinned-tab list is passed in via closure so this stays
 * pure.
 */
function buildNavActiveOverrides(pinnedTabKeys: ReadonlySet<SettingsTabKey>) {
  const overrides: Record<string, ActiveChecker> = {
    notifications: pathname => {
      return pathname === '/notifications' || pathname.startsWith('/notifications/');
    },
    settings: (pathname, searchParams) => {
      const pathMatches = pathname === '/settings' || pathname.startsWith('/settings/');
      if (!pathMatches) return false;
      if (pathname === '/settings') {
        const tab = settingsTabFromSearch(searchParams);
        if (isSettingsTabKey(tab) && pinnedTabKeys.has(tab)) return false;
        return true;
      }
      // Routed sub-pages (e.g. /settings/members). If the corresponding tab
      // is pinned, its dedicated sidebar entry owns the active state.
      const subKey = pathname.slice('/settings/'.length).split('/')[0];
      if (subKey && isSettingsTabKey(subKey) && pinnedTabKeys.has(subKey)) return false;
      return true;
    },
  };
  return overrides;
}

function isNavItemActive(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  item: NavItem,
  overrides: Record<string, ActiveChecker>,
): boolean {
  const [basePath, queryPart] = item.href.split('?');
  const tabFromHref = queryPart ? new URLSearchParams(queryPart).get('tab') : null;

  // Settings tab-specific hrefs (e.g. /settings?tab=integrations)
  if (tabFromHref && basePath === '/settings') {
    return pathname === '/settings' && settingsTabFromSearch(searchParams) === tabFromHref;
  }

  // Special-case nav items with custom active logic
  const override = overrides[item.key];
  if (override) return override(pathname, searchParams, basePath ?? '');

  // Default: path prefix match
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isPinnedTabActive(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  tabKey: SettingsTabKey,
): boolean {
  if (isRoutedSettingsTab(tabKey)) {
    const expected = `/settings/${tabKey}`;
    return pathname === expected || pathname.startsWith(`${expected}/`);
  }
  if (pathname !== '/settings') return false;
  return settingsTabFromSearch(searchParams) === tabKey;
}

/**
 * Sidebar navigation items organized into labeled groups (Overview, Operations,
 * Finance, System). Each group is filtered by RBAC — groups with no visible
 * items are hidden entirely. Active item shows highlight.
 *
 * The `system` group additionally renders the current user's pinned settings
 * tabs below the canonical `Settings` entry. Pinned entries respect the same
 * permission filter as their underlying settings tab and own the active state
 * when `?tab=<key>` matches.
 */
function NavItemsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const flagBag = useFlagBag();
  const t = useTranslations('Navigation');
  const tSettingsTabs = useTranslations('Settings.tabs');

  // Pinned settings tabs (global per user). We deliberately do NOT suspend the
  // sidebar on this query — render an empty list while loading so the initial
  // sidebar paint isn't blocked on network IO. Errors are swallowed (the user
  // simply sees no pinned entries).
  const pinsQuery = useQuery({
    ...trpc.user.pins.list.queryOptions({ kind: PIN_KIND }),
    // Pinned-tab UX is forgiving — short stale window is fine, and we don't
    // want a tab-switch to trigger an extra GET on every paint.
    staleTime: 60_000,
  });

  const pinnedTabKeys = useMemo(() => {
    const set = new Set<SettingsTabKey>();
    for (const pin of pinsQuery.data ?? []) {
      if (pin.kind !== PIN_KIND) continue;
      if (isSettingsTabKey(pin.key)) set.add(pin.key);
    }
    return set;
  }, [pinsQuery.data]);

  const overrides = useMemo(() => buildNavActiveOverrides(pinnedTabKeys), [pinnedTabKeys]);

  // Build the ordered list of pinned-tab nav entries respecting permissions and
  // insertion order. `pinsQuery.data` is already ordered by `pinnedAt` ascending
  // server-side; we preserve that ordering here.
  const visiblePinnedTabs = useMemo(() => {
    const tabByKey = new Map<SettingsTabKey, SettingsTabDef>(
      SETTINGS_TABS.map(tab => [tab.key, tab]),
    );
    const out: Array<{ tab: SettingsTabDef; pinnedAt: Date }> = [];
    for (const pin of pinsQuery.data ?? []) {
      if (pin.kind !== PIN_KIND) continue;
      if (!isSettingsTabKey(pin.key)) continue;
      const tab = tabByKey.get(pin.key);
      if (!tab) continue;
      if (tab.permission && !can(tab.permission.resource, tab.permission.actions)) continue;
      out.push({ tab, pinnedAt: pin.pinnedAt });
    }
    return out;
  }, [pinsQuery.data, can]);

  return (
    <>
      {navigationGroups.map(group => {
        // Filter items by permission AND feature flag (both must pass).
        const visibleItems = group.items.filter(item => {
          if (item.flag && !flagBag[item.flag]) return false;
          if (!item.permission) return true;
          return can(item.permission.resource, item.permission.actions);
        });

        const renderPinnedTabs = group.key === 'system' && visiblePinnedTabs.length > 0;

        // Hide groups with no visible items (pinned tabs alone are not enough to
        // resurrect a group whose canonical items are all permission-hidden,
        // because pinned tabs sit below Settings — if Settings itself is
        // hidden, the pinned entries would be orphaned).
        if (visibleItems.length === 0) return null;

        // The first group ("overview" with just Dashboard) renders without a label.
        // Inline the narrowing so TS knows group.key is a valid groups.* key
        // inside the SidebarGroupLabel branch (drops the prior `as` casts).
        return (
          <SidebarGroup key={group.key} className={group.key === 'overview' ? 'pb-0' : undefined}>
            {group.key !== 'overview' && (
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {tDyn(t, 'groups', group.key)}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleItems.map(item => {
                const isActive = isNavItemActive(pathname, searchParams, item, overrides);

                const label = t(item.key);

                return (
                  <SidebarMenuItem key={item.key} className="relative">
                    <SidebarMenuButton
                      render={
                        <Link href={item.href} aria-current={isActive ? 'page' : undefined} />
                      }
                      isActive={isActive}
                      tooltip={label}>
                      <item.icon className="h-4 w-4" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {item.key === 'workflows' && <WorkflowNavBadge />}
                  </SidebarMenuItem>
                );
              })}

              {renderPinnedTabs &&
                visiblePinnedTabs.map(({ tab }) => {
                  const isActive = isPinnedTabActive(pathname, searchParams, tab.key);
                  const label = tSettingsTabs(tab.i18nKey);
                  const href = getSettingsTabHref(tab.key);
                  return (
                    <SidebarMenuItem
                      key={`pinned:${tab.key}`}
                      data-pinned-tab="true"
                      className="relative">
                      <SidebarMenuButton
                        render={<Link href={href} aria-current={isActive ? 'page' : undefined} />}
                        isActive={isActive}
                        tooltip={label}>
                        <tab.icon className="h-4 w-4" />
                        <span>{label}</span>
                        {/* Trailing pin glyph — context cue that this entry was
                            user-pinned. Subtle (muted, small) so it adds info
                            without competing with the row icon. Hidden in
                            collapsed sidebar mode (group-data-collapsible=icon)
                            so the icon column stays tidy. */}
                        <Pin
                          aria-hidden="true"
                          className="ms-auto h-2.5 w-2.5 rotate-45 text-muted-foreground/50 group-data-[collapsible=icon]:hidden"
                        />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroup>
        );
      })}
    </>
  );
}

/** `useSearchParams` must be under Suspense (Next.js). */
export function NavItems() {
  return (
    <Suspense fallback={null}>
      <NavItemsContent />
    </Suspense>
  );
}
