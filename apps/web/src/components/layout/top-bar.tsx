"use client";

import { FilePlus, Search, Upload, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ContractWizardDialog } from "@/components/contracts/contract-wizard/wizard-dialog";
import { useBreadcrumbContext } from "@/components/layout/breadcrumb-context";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { CommandPalette } from "@/components/search/command-palette";
import { useSearch } from "@/components/search/search-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

/**
 * Top bar above main content area.
 * Left: SidebarTrigger (hamburger) + Breadcrumb (current page path)
 * Right: Quick action icon buttons + Search + Notifications
 */
export function TopBar() {
  const pathname = usePathname();
  const t = useTranslations("TopBar");
  const router = useRouter();
  const { setOpen: setSearchOpen } = useSearch();

  const [contractWizardOpen, setContractWizardOpen] = useState(false);

  const { overrides } = useBreadcrumbContext();
  const tNav = useTranslations("Navigation");

  // Build breadcrumb segments from pathname (locale already stripped by next-intl)
  const segments = pathname.split("/").filter(Boolean);

  /** Detect UUID/CUID segments that need an override to display properly */
  const isIdSegment = (segment: string): boolean => /^[a-zA-Z0-9_-]{20,}$/.test(segment);

  /** Map URL segment → translated label. Uses Navigation i18n, context overrides, or skeleton. */
  const breadcrumbLabel = (segment: string): string | null => {
    // 1. Context override from detail pages (entity name)
    const override = overrides.get(segment);
    if (override) return override.label;

    // 2. ID segments without override yet → show skeleton
    if (isIdSegment(segment)) return null;

    // 3. Translated navigation label (contractors → Kontrahenci, etc.)
    if (tNav.has(segment)) return tNav(segment);

    // 4. Fallback: capitalize the URL segment
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
  };

  return (
    <>
      <header className="glass-subtle sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b-0 px-4">
        <SidebarTrigger className="-ms-1" />
        <Separator orientation="vertical" className="!self-center me-2 h-4" />

        {/* Unified breadcrumb — single source for all pages */}
        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              const label = breadcrumbLabel(segment);
              const href = `/${segments.slice(0, index + 1).join("/")}`;

              return (
                <span key={`${segment}-${index}`} className="contents">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {label === null ? (
                      <Skeleton className="h-4 w-24 rounded" />
                    ) : isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={(props) => <Link {...props} href={href} />}>
                        {label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => router.push("/contractors?action=new")}
                />
              }
            >
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
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => router.push("/invoices?action=upload")}
                />
              }
            >
              <Upload className="h-4 w-4" />
              <span className="sr-only">{t("uploadInvoice")}</span>
            </TooltipTrigger>
            <TooltipContent>{t("uploadInvoice")}</TooltipContent>
          </Tooltip>

          {/* Search bar trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="search-trigger hidden md:flex h-9 w-[240px] items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground"
          >
            <Search className="h-4 w-4" />
            <span>{t("search")}...</span>
            <kbd className="ms-auto rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground shadow-[0_1px_0_0] shadow-border/40">
              {"\u2318"}K
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

      {/* Animated accent line below header */}
      <div className="accent-line sticky top-14 z-30 w-full" />

      {/* Contract creation wizard (portal/dialog, works from any page) */}
      <ContractWizardDialog open={contractWizardOpen} onOpenChange={setContractWizardOpen} />

      {/* Command palette (global search) */}
      <CommandPalette />
    </>
  );
}
