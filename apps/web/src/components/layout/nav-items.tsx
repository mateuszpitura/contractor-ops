"use client";

import { useTranslations } from "next-intl";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navigationItems } from "@/lib/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Sidebar navigation items filtered by the user's role permissions.
 * Unauthorized items are completely hidden (not disabled/grayed).
 * Active item shows Indigo highlight.
 * Labels are resolved from translation keys.
 */
export function NavItems() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const t = useTranslations("Navigation");

  // Filter items by permission. Null permission = always visible.
  const visibleItems = navigationItems.filter((item) => {
    if (!item.permission) return true;
    return can(item.permission.resource, item.permission.actions);
  });

  return (
    <SidebarMenu>
      {visibleItems.map((item) => {
        // Check if current path matches this nav item
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        const label = t(item.key as Parameters<typeof t>[0]);

        return (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={isActive}
              tooltip={label}
            >
              <item.icon className="h-4 w-4" />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
