'use client';

import { NavItems } from '@/components/layout/nav-items';
import { OrgSwitcher } from '@/components/layout/org-switcher';
import { UserMenu } from '@/components/layout/user-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

/**
 * App sidebar with Linear-style collapsible behavior.
 * - SidebarHeader: OrgSwitcher
 * - SidebarContent: 10 nav items (filtered by RBAC)
 * - SidebarFooter: UserMenu
 * - Expanded: 240px, Collapsed: 48px (icon-only with tooltips)
 * - Below 1024px: Sheet component for mobile
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavItems />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
