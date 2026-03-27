"use client";

import { useTranslations } from "next-intl";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navigationGroups } from "@/lib/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Link, usePathname } from "@/i18n/navigation";
import { WorkflowNavBadge } from "@/components/workflows/workflow-nav-badge";

/**
 * Sidebar navigation items organized into labeled groups (Overview, Operations,
 * Finance, System). Each group is filtered by RBAC — groups with no visible
 * items are hidden entirely. Active item shows highlight.
 */
export function NavItems() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const t = useTranslations("Navigation");

  return (
    <>
      {navigationGroups.map((group) => {
        // Filter items by permission
        const visibleItems = group.items.filter((item) => {
          if (!item.permission) return true;
          return can(item.permission.resource, item.permission.actions);
        });

        // Hide groups with no visible items
        if (visibleItems.length === 0) return null;

        // The first group ("overview" with just Dashboard) renders without a label
        const showLabel = group.key !== "overview";

        return (
          <SidebarGroup key={group.key} className={showLabel ? undefined : "pb-0"}>
            {showLabel && (
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {t(`groups.${group.key}` as Parameters<typeof t>[0])}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                const label = t(item.key as Parameters<typeof t>[0]);

                return (
                  <SidebarMenuItem key={item.key} className="relative">
                    <SidebarMenuButton
                      render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
                      isActive={isActive}
                      tooltip={label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {item.key === "workflows" && <WorkflowNavBadge />}
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
