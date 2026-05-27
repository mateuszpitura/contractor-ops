import { useMemo } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useSettingsTabPins } from '../../../hooks/use-settings-tab-pins.js';
import { tDyn } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { NavItem } from '../../../lib/navigation.js';
import { navigationGroups } from '../../../lib/navigation.js';
import type { SettingsTabDef, SettingsTabKey } from '../../../lib/settings-tabs.js';
import {
  getSettingsTabHref,
  isRoutedSettingsTab,
  isSettingsTabKey,
  SETTINGS_TABS,
} from '../../../lib/settings-tabs.js';
import { useFlagBag } from '../feature-flag-context.js';

function settingsTabFromSearch(searchParams: URLSearchParams): string {
  return searchParams.get('tab') ?? 'general';
}

function isNavItemActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: NavItem,
  pinnedTabKeys: ReadonlySet<SettingsTabKey>,
): boolean {
  const [basePath, queryPart] = item.href.split('?');
  const tabFromHref = queryPart ? new URLSearchParams(queryPart).get('tab') : null;

  if (tabFromHref && basePath === '/settings') {
    return pathname === '/settings' && settingsTabFromSearch(searchParams) === tabFromHref;
  }

  if (item.key === 'notifications') {
    return pathname === '/notifications' || pathname.startsWith('/notifications/');
  }

  // Settings entry must yield to a pinned-tab sibling when the active tab is
  // pinned — otherwise both the parent and the pinned row would highlight.
  if (item.key === 'settings') {
    const pathMatches = pathname === '/settings' || pathname.startsWith('/settings/');
    if (!pathMatches) return false;
    if (pathname === '/settings') {
      const tab = settingsTabFromSearch(searchParams);
      if (isSettingsTabKey(tab) && pinnedTabKeys.has(tab)) return false;
      return true;
    }
    const subKey = pathname.slice('/settings/'.length).split('/')[0];
    if (subKey && isSettingsTabKey(subKey) && pinnedTabKeys.has(subKey)) return false;
    return true;
  }

  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isPinnedTabActive(
  pathname: string,
  searchParams: URLSearchParams,
  tabKey: SettingsTabKey,
): boolean {
  if (isRoutedSettingsTab(tabKey)) {
    const expected = `/settings/${tabKey}`;
    return pathname === expected || pathname.startsWith(`${expected}/`);
  }
  if (pathname !== '/settings') return false;
  return settingsTabFromSearch(searchParams) === tabKey;
}

export type NavItemsPinnedTab = {
  key: string;
  href: string;
  label: string;
  isActive: boolean;
  icon: NavItem['icon'];
};

export type NavItemsGroupView = {
  key: string;
  label: string | null;
  items: Array<{
    key: string;
    href: string;
    label: string;
    isActive: boolean;
    icon: NavItem['icon'];
    showWorkflowBadge: boolean;
  }>;
  pinnedTabs: NavItemsPinnedTab[];
};

export function useNavItems(pathname: string, searchParams: URLSearchParams) {
  const { can } = usePermissions();
  const flagBag = useFlagBag();
  const t = useTranslations('Navigation');
  const tSettingsTabs = useTranslations('Settings.tabs');
  const { pinnedKeys, pinnedOrder } = useSettingsTabPins();

  const visiblePinnedTabs = useMemo<NavItemsPinnedTab[]>(() => {
    const tabByKey = new Map<SettingsTabKey, SettingsTabDef>(
      SETTINGS_TABS.map(tab => [tab.key, tab]),
    );
    const out: NavItemsPinnedTab[] = [];
    for (const key of pinnedOrder) {
      const tab = tabByKey.get(key);
      if (!tab) continue;
      if (tab.permission && !can(tab.permission.resource, tab.permission.actions)) continue;
      out.push({
        key: tab.key,
        href: getSettingsTabHref(tab.key),
        label: tSettingsTabs(tab.i18nKey),
        isActive: isPinnedTabActive(pathname, searchParams, tab.key),
        icon: tab.icon,
      });
    }
    return out;
  }, [pinnedOrder, can, pathname, searchParams, tSettingsTabs]);

  const groups = useMemo(() => {
    const result: NavItemsGroupView[] = [];

    for (const group of navigationGroups) {
      const visibleItems = group.items.filter(item => {
        if (item.flag && !flagBag[item.flag]) return false;
        if (!item.permission) return true;
        return can(item.permission.resource, item.permission.actions);
      });

      if (visibleItems.length === 0) continue;

      result.push({
        key: group.key,
        label: group.key === 'overview' ? null : tDyn(t, 'groups', group.key),
        items: visibleItems.map(item => ({
          key: item.key,
          href: item.href,
          label: t(item.key),
          isActive: isNavItemActive(pathname, searchParams, item, pinnedKeys),
          icon: item.icon,
          showWorkflowBadge: item.key === 'workflows',
        })),
        pinnedTabs: group.key === 'system' ? visiblePinnedTabs : [],
      });
    }

    return result;
  }, [can, flagBag, pathname, searchParams, t, pinnedKeys, visiblePinnedTabs]);

  return { groups } as const;
}
