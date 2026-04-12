"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkflowNavBadge } from "@/components/workflows/workflow-nav-badge";
import { usePermissions } from "@/hooks/use-permissions";
import { Link, usePathname } from "@/i18n/navigation";
import type { NavItem } from "@/lib/navigation";
import { navigationGroups } from "@/lib/navigation";

function settingsTabFromSearch(searchParams: ReturnType<typeof useSearchParams>): string {
  return searchParams.get("tab") ?? "general";
}

/**
 * Sidebar active state must consider `?tab=` on /settings — usePathname() has no query string,
 * so hrefs like `/settings?tab=integrations` never matched and plain `/settings` always won.
 */
function isNavItemActive(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  item: NavItem,
): boolean {
  const [basePath, queryPart] = item.href.split("?");
  const tabFromHref = queryPart ? new URLSearchParams(queryPart).get("tab") : null;

  if (tabFromHref && basePath === "/settings") {
    if (pathname !== "/settings") return false;
    return settingsTabFromSearch(searchParams) === tabFromHref;
  }

  if (item.key === "notifications") {
    if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
      return true;
    }
    if (pathname === "/settings") {
      return settingsTabFromSearch(searchParams) === "notifications";
    }
    return false;
  }

  if (item.key === "settings") {
    const pathMatches = pathname === "/settings" || pathname.startsWith("/settings/");
    if (!pathMatches) return false;
    if (pathname === "/settings") {
      const tab = settingsTabFromSearch(searchParams);
      if (tab === "integrations" || tab === "notifications") return false;
    }
    return true;
  }

  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

/**
 * Sidebar navigation items organized into labeled groups (Overview, Operations,
 * Finance, System). Each group is filtered by RBAC — groups with no visible
 * items are hidden entirely. Active item shows highlight.
 */
function NavItemsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
                const isActive = isNavItemActive(pathname, searchParams, item);

                const label = t(item.key as Parameters<typeof t>[0]);

                return (
                  <SidebarMenuItem key={item.key} className="relative">
                    <SidebarMenuButton
                      render={
                        <Link href={item.href} aria-current={isActive ? "page" : undefined} />
                      }
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

/** `useSearchParams` must be under Suspense (Next.js). */
export function NavItems() {
  return (
    <Suspense fallback={null}>
      <NavItemsContent />
    </Suspense>
  );
}
