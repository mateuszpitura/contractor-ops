import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@contractor-ops/ui/components/shadcn/sidebar';
import { Pin } from 'lucide-react';

import { WorkflowNavBadgeContainer } from '../../components/workflows/workflow-nav-badge-container.js';
import { Link } from '../../i18n/navigation.js';
import type { NavItemsGroupView } from './hooks/use-nav-items.js';

interface NavItemsProps {
  groups: NavItemsGroupView[];
}

export function NavItems({ groups }: NavItemsProps) {
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
                    <Link href={item.href} aria-current={item.isActive ? 'page' : undefined} />
                  }
                  isActive={item.isActive}
                  tooltip={item.label}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.showWorkflowBadge ? <WorkflowNavBadgeContainer /> : null}
              </SidebarMenuItem>
            ))}
            {group.pinnedTabs.map(tab => (
              <SidebarMenuItem
                key={`pinned:${tab.key}`}
                data-pinned-tab="true"
                className="relative">
                <SidebarMenuButton
                  render={<Link href={tab.href} aria-current={tab.isActive ? 'page' : undefined} />}
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
