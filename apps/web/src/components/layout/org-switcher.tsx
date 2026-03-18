"use client";

import { ChevronsUpDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

/**
 * Organization switcher dropdown at the top of the sidebar.
 * Shows current org name. If user has multiple orgs, lists them to switch.
 * Calls authClient.organization.setActive() on switch.
 */
export function OrgSwitcher() {
  const { isMobile } = useSidebar();
  const { data: orgList } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const currentOrg = activeOrg;
  const organizations = orgList ?? [];

  const handleOrgSwitch = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          />
        }
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">
            {currentOrg?.name ?? "Select organization"}
          </span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleOrgSwitch(org.id)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-sm border">
              <Building2 className="size-4 shrink-0" />
            </div>
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2" disabled>
          <div className="flex size-6 items-center justify-center rounded-md border bg-background">
            <span className="text-xs">+</span>
          </div>
          <span className="text-muted-foreground">Add organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
