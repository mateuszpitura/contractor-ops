"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  FolderOpen,
  Clock,
  Banknote,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from "@/lib/avatar-initials";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { PortalMobileMenu } from "./portal-mobile-menu";

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { label: "Overview", href: "/portal", icon: LayoutDashboard },
  { label: "Contracts", href: "/portal/contracts", icon: FileText },
  { label: "Invoices", href: "/portal/invoices", icon: Receipt },
  { label: "Documents", href: "/portal/documents", icon: FolderOpen },
  { label: "Time", href: "/portal/time", icon: Clock },
  { label: "Payments", href: "/portal/payments", icon: Banknote },
  { label: "Settings", href: "/portal/settings", icon: Settings },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a nav item is active based on the current pathname.
 * The overview link (/portal) is only active when the path is exactly /portal
 * or /portal/ (with optional locale prefix). All other links match on prefix.
 */
function isNavActive(href: string, pathname: string): boolean {
  // Strip locale prefix (e.g., /en/portal -> /portal)
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");

  if (href === "/portal") {
    return path === "/portal" || path === "/portal/";
  }
  return path.startsWith(href);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PortalTopBarProps {
  orgName: string;
  orgLogo?: string | null;
  contractorName: string;
  contractorEmail: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal top bar navigation.
 *
 * Layout (D-01):
 * - Left: org logo + name
 * - Center: nav links (hidden on mobile <768px)
 * - Right: profile dropdown with avatar (hidden on mobile <768px)
 * - Mobile: hamburger icon opening Sheet nav
 *
 * Height: 56px (h-14). Background: card with bottom border.
 */
export function PortalTopBar({
  orgName,
  orgLogo,
  contractorName,
  contractorEmail,
}: PortalTopBarProps) {
  const tAria = useTranslations("Common.aria");
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/portal/clear-session", { method: "POST" });
    } finally {
      router.push("/portal/login");
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4">
        {/* Left: Org branding */}
        <div className="flex items-center gap-2 shrink-0">
          {orgLogo && (
            <img
              src={orgLogo}
              alt={orgName}
              className="h-8 w-8 rounded-md object-cover"
            />
          )}
          <span className="text-sm font-semibold">{orgName}</span>
        </div>

        {/* Center: Desktop nav links */}
        <nav
          className="hidden md:flex items-center gap-6 flex-1 justify-center"
          aria-label={tAria("portalNavigation")}
        >
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 pb-[calc(theme(spacing.4)-2px)] pt-4 text-[13px] font-normal transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Spacer for mobile (pushes hamburger to right) */}
        <div className="flex-1 md:hidden" />

        {/* Right: Desktop profile dropdown */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors outline-none"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{getAvatarInitials(contractorName)}</AvatarFallback>
                  </Avatar>
                </button>
              }
            />
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{contractorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {contractorEmail}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile: Hamburger button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label={tAria("openNavigationMenu")}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile: Sheet menu */}
        <PortalMobileMenu
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          orgName={orgName}
          contractorName={contractorName}
          contractorEmail={contractorEmail}
        />
      </div>
    </header>
  );
}
