import { useMemo } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { tDyn } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { NavItem } from '../../../lib/navigation.js';
import { navigationGroups } from '../../../lib/navigation.js';
import { useFlagBag } from '../feature-flag-context.js';

function isNavItemActive(pathname: string, searchParams: URLSearchParams, item: NavItem): boolean {
  const [basePath, queryPart] = item.href.split('?');
  const tabFromHref = queryPart ? new URLSearchParams(queryPart).get('tab') : null;

  if (tabFromHref && basePath === '/settings') {
    return pathname === '/settings' && (searchParams.get('tab') ?? 'general') === tabFromHref;
  }

  if (item.key === 'notifications') {
    return pathname === '/notifications' || pathname.startsWith('/notifications/');
  }

  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

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
};

export function useNavItems(pathname: string, searchParams: URLSearchParams) {
  const { can } = usePermissions();
  const flagBag = useFlagBag();
  const t = useTranslations('Navigation');

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
          isActive: isNavItemActive(pathname, searchParams, item),
          icon: item.icon,
          showWorkflowBadge: item.key === 'workflows',
        })),
      });
    }

    return result;
  }, [can, flagBag, pathname, searchParams, t]);

  return { groups } as const;
}
