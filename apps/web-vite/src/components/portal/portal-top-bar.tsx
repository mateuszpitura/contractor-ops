import { Avatar, AvatarFallback } from '@contractor-ops/ui/components/shadcn/avatar';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Image } from '@unpic/react';
import { Building2, LogOut, Menu } from 'lucide-react';
import { useCallback } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../lib/avatar-initials.js';
import { PORTAL_NAV_ITEMS } from '../../lib/portal-navigation.js';
import { prefetchRoute } from '../../lib/route-prefetch.js';
import { cn } from '../../lib/utils.js';
import type { usePortalTopBar } from './hooks/use-portal-top-bar.js';
import { OrgSwitcherList } from './org-switcher-list.js';
import { PortalMobileMenuContainer } from './portal-mobile-menu-container.js';

function isNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
  if (href === '/portal') {
    return path === '/portal' || path === '/portal/';
  }
  return path.startsWith(href);
}

interface PortalTopBarProps {
  orgName: string;
  orgLogo?: string | null;
  contractorName: string;
  contractorEmail: string;
  bar: ReturnType<typeof usePortalTopBar>;
}

export function PortalTopBar({
  orgName,
  orgLogo,
  contractorName,
  contractorEmail,
  bar,
}: PortalTopBarProps) {
  const tNav = useTranslations('Portal.nav');
  const tAria = useTranslations('Common.aria');
  const tSwitch = useTranslations('Portal.orgSwitch');
  const { pathname, orgSwitcher, mobileMenuOpen, setMobileMenuOpen, handleLogout } = bar;

  const NAV_ITEMS = PORTAL_NAV_ITEMS.map(item => ({
    ...item,
    label: tNav(item.key),
  }));

  const handleSelectOrg = useCallback(
    (target: { contractorId: string; organizationId: string }) => {
      void orgSwitcher.switchTo(target);
    },
    [orgSwitcher],
  );
  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), [setMobileMenuOpen]);

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4">
        <div className="flex items-center gap-2 shrink-0">
          {!!orgLogo && (
            <Image
              src={orgLogo}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover"
            />
          )}
          <span className="text-sm font-semibold">{orgName}</span>
        </div>

        <nav
          className="hidden md:flex items-center gap-6 flex-1 justify-center"
          aria-label={tAria('portalNavigation')}>
          {NAV_ITEMS.map(item => {
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onPointerEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 pb-[calc(theme(spacing.4)-2px)] pt-4 text-[13px] transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'border-primary text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground font-normal hover:text-foreground',
                )}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={tAria('profileMenu')}
                  className="flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar size="sm">
                    <AvatarFallback>{getAvatarInitials(contractorName)}</AvatarFallback>
                  </Avatar>
                </button>
              }
            />
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-[220px]">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{contractorName}</span>
                  <span className="text-xs text-muted-foreground">{contractorEmail}</span>
                </div>
              </DropdownMenuLabel>
              {orgSwitcher.isAvailable ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Building2 className="me-2 h-4 w-4" aria-hidden="true" />
                      {tSwitch('label')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-[240px] p-1">
                      <OrgSwitcherList
                        orgs={orgSwitcher.orgs}
                        switchingContractorId={orgSwitcher.switchingContractorId}
                        onSelect={handleSelectOrg}
                        variant="menu"
                      />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="me-2 h-4 w-4" />
                {tNav('signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={openMobileMenu}
          aria-label={tAria('openNavigationMenu')}>
          <Menu className="h-5 w-5" />
        </Button>

        <PortalMobileMenuContainer
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          orgName={orgName}
          orgLogo={orgLogo ?? null}
          contractorName={contractorName}
          contractorEmail={contractorEmail}
        />
      </div>
    </header>
  );
}
