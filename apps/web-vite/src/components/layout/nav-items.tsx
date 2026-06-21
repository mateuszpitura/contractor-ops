import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@contractor-ops/ui/components/shadcn/sidebar';
import { Pin } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link, usePathname } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { prefetchRoute } from '../../lib/route-prefetch.js';
import type { NavBadgeCounts } from './hooks/use-nav-badges.js';
import { useNavBadges } from './hooks/use-nav-badges.js';
import type { NavItemsGroupView } from './hooks/use-nav-items.js';
import { useNavItems } from './hooks/use-nav-items.js';
import { NavActionBadge } from './nav-action-badge.js';

interface NavPrefetchLinkProps extends Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> {
  href: string;
  isActive: boolean;
}

// Used as a `SidebarMenuButton render={…}` element: Base UI's useRender merges
// the button's children (icon + label) and props into this element, so we MUST
// spread `...props` onto the Link — otherwise the merged children are dropped
// and the nav item renders with no visible icon/label.
function NavPrefetchLink({ href, isActive, ...props }: NavPrefetchLinkProps) {
  const handlePrefetch = useCallback(() => prefetchRoute(href), [href]);
  return (
    <Link
      {...props}
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onPointerEnter={handlePrefetch}
      onFocus={handlePrefetch}
    />
  );
}

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
                  render={<NavPrefetchLink href={item.href} isActive={item.isActive} />}
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
                  render={<NavPrefetchLink href={tab.href} isActive={tab.isActive} />}
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

export function NavItemsContainer() {
  const pathname = usePathname();
  const [searchParams] = useSearchParams();
  const { groups } = useNavItems(pathname, searchParams);
  const badgeCounts = useNavBadges();

  if (groups.length === 0) return null;

  return <NavItems groups={groups} badgeCounts={badgeCounts} />;
}
