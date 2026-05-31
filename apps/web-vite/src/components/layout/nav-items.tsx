import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@contractor-ops/ui/components/shadcn/sidebar';
import { Pin } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { prefetchRoute } from '../../lib/route-prefetch.js';
import type { NavBadgeCounts } from './hooks/use-nav-badges.js';
import type { NavItemsGroupView } from './hooks/use-nav-items.js';
import { NavActionBadge } from './nav-action-badge.js';

interface NavItemsProps {
  groups: NavItemsGroupView[];
  badgeCounts: NavBadgeCounts;
}

export function NavItems({ groups, badgeCounts }: NavItemsProps) {
  const tNav = useTranslations('Navigation');
  const tAria = useTranslations('Common.aria');

  const badgeAriaLabel = (key: NonNullable<NavItemsGroupView['items'][number]['navBadgeKey']>) => {
    const count = badgeCounts[key];
    switch (key) {
      case 'workflows':
        return tAria('overdueTasks', { count });
      case 'approvals':
        return tAria('pendingApprovalsAction', { count });
      case 'time':
        return tAria('pendingTimesheetReviews', { count });
      case 'notifications':
        return tAria('notificationsWithUnread', { title: tNav('notifications'), count });
    }
  };

  return (
    <>
      {groups.map(group => (
        <SidebarGroup key={group.key} className={group.key === 'overview' ? 'pb-0' : undefined}>
          {group.label ? (
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
          ) : null}
          <SidebarMenu>
            {group.items.map(item => (
              <SidebarMenuItem key={item.key} className="relative">
                <SidebarMenuButton
                  render={
                    <Link
                      href={item.href}
                      aria-current={item.isActive ? 'page' : undefined}
                      onPointerEnter={() => prefetchRoute(item.href)}
                      onFocus={() => prefetchRoute(item.href)}
                    />
                  }
                  isActive={item.isActive}
                  tooltip={item.label}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.navBadgeKey ? (
                  <NavActionBadge
                    count={badgeCounts[item.navBadgeKey]}
                    ariaLabel={badgeAriaLabel(item.navBadgeKey)}
                  />
                ) : null}
              </SidebarMenuItem>
            ))}
            {group.pinnedTabs.map(tab => (
              <SidebarMenuItem
                key={`pinned:${tab.key}`}
                data-pinned-tab="true"
                className="relative">
                <SidebarMenuButton
                  render={
                    <Link
                      href={tab.href}
                      aria-current={tab.isActive ? 'page' : undefined}
                      onPointerEnter={() => prefetchRoute(tab.href)}
                      onFocus={() => prefetchRoute(tab.href)}
                    />
                  }
                  isActive={tab.isActive}
                  tooltip={tab.label}>
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <Pin
                    aria-hidden="true"
                    className="ms-auto h-2.5 w-2.5 rotate-45 text-muted-foreground/50 group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
