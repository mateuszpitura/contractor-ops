"use client";

import { useState } from "react";
import { UserPlus, FilePlus, Upload, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePathname } from "@/i18n/navigation";
import { ContractWizardDialog } from "@/components/contracts/contract-wizard/wizard-dialog";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { useSearch } from "@/components/search/search-provider";
import { CommandPalette } from "@/components/search/command-palette";

/**
 * Top bar above main content area.
 * Left: SidebarTrigger (hamburger) + Breadcrumb (current page path)
 * Right: Quick action icon buttons + Search + Notifications
 */
export function TopBar() {
  const pathname = usePathname();
  const t = useTranslations("TopBar");
  const { setOpen: setSearchOpen } = useSearch();

  const [contractWizardOpen, setContractWizardOpen] = useState(false);

  // Build breadcrumb segments from pathname (locale already stripped by next-intl)
  const segments = pathname.split("/").filter(Boolean);

  const breadcrumbLabel = (segment: string): string => {
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => (
              <span key={segment} className="contents">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {index === segments.length - 1 ? (
                    <BreadcrumbPage>{breadcrumbLabel(segment)}</BreadcrumbPage>
                  ) : (
                    <span className="text-muted-foreground">
                      {breadcrumbLabel(segment)}
                    </span>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
              <UserPlus className="h-4 w-4" />
              <span className="sr-only">{t("addContractor")}</span>
            </TooltipTrigger>
            <TooltipContent>{t("addContractor")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setContractWizardOpen(true)}
                />
              }
            >
              <FilePlus className="h-4 w-4" />
              <span className="sr-only">{t("newContract")}</span>
            </TooltipTrigger>
            <TooltipContent>{t("newContract")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
              <Upload className="h-4 w-4" />
              <span className="sr-only">{t("uploadInvoice")}</span>
            </TooltipTrigger>
            <TooltipContent>{t("uploadInvoice")}</TooltipContent>
          </Tooltip>

          {/* Search bar trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex h-9 w-[240px] items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-accent"
          >
            <Search className="h-4 w-4" />
            <span>{t("search")}...</span>
            <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono text-muted-foreground">
              Cmd+K
            </kbd>
          </button>

          {/* Mobile search icon */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={() => setSearchOpen(true)}
                />
              }
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">{t("search")}</span>
            </TooltipTrigger>
            <TooltipContent>{t("search")}</TooltipContent>
          </Tooltip>

          <NotificationPopover />
        </div>
      </header>

      {/* Contract creation wizard (portal/dialog, works from any page) */}
      <ContractWizardDialog
        open={contractWizardOpen}
        onOpenChange={setContractWizardOpen}
      />

      {/* Command palette (global search) */}
      <CommandPalette />
    </>
  );
}
