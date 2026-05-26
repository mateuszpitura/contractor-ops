import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@contractor-ops/ui/components/shadcn/sidebar';

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
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
