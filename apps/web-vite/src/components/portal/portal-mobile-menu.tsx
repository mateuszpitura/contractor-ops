import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Image } from '@unpic/react';
import {
  Banknote,
  Clock,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
} from 'lucide-react';

import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import type { usePortalMobileMenu } from './hooks/use-portal-top-bar.js';
import { OrgSwitcherList } from './org-switcher-list.js';

function getNavItems(t: LooseTranslator) {
  return [
    { label: t('overview'), href: '/portal', icon: LayoutDashboard },
    { label: t('contracts'), href: '/portal/contracts', icon: FileText },
    { label: t('invoices'), href: '/portal/invoices', icon: Receipt },
    { label: t('documents'), href: '/portal/documents', icon: FolderOpen },
    { label: t('time'), href: '/portal/time', icon: Clock },
    { label: t('equipment'), href: '/portal/equipment', icon: Package },
    { label: t('payments'), href: '/portal/payments', icon: Banknote },
    { label: t('settings'), href: '/portal/settings', icon: Settings },
  ] as const;
}

function isNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
  if (href === '/portal') {
    return path === '/portal' || path === '/portal/';
  }
  return path.startsWith(href);
}

interface PortalMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  orgLogo: string | null;
  contractorName: string;
  contractorEmail: string;
  menu: ReturnType<typeof usePortalMobileMenu>;
}

export function PortalMobileMenu({
  open,
  onOpenChange,
  orgName,
  orgLogo,
  contractorName,
  contractorEmail,
  menu,
}: PortalMobileMenuProps) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('Portal.nav');
  const tSwitch = useTranslations('Portal.orgSwitch');
  const { pathname, orgSwitcher, handleNavClick, handleLogout } = menu;

  const NAV_ITEMS = getNavItems(t);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            {orgLogo ? (
              <Image
                src={orgLogo}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                {orgName.charAt(0).toUpperCase()}
              </span>
            )}
            <SheetTitle className="min-w-0 truncate">{orgName}</SheetTitle>
          </div>
          <SheetDescription className="sr-only">{t('menuDescription')}</SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col flex-1" aria-label={tAria('mobilePortalNavigation')}>
          {NAV_ITEMS.map(item => {
            const active = isNavActive(item.href, pathname);
            return (
              <button
                key={item.href}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handleNavClick(item.href)}
                className={cn(
                  'flex min-h-12 items-center gap-3 border-b px-4 py-3 text-base transition-colors text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active
                    ? 'bg-accent/50 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
                )}>
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {orgSwitcher.isAvailable ? (
          <div className="px-2 pb-2">
            <Separator className="my-2" />
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tSwitch('label')}
            </p>
            <OrgSwitcherList
              orgs={orgSwitcher.orgs}
              switchingContractorId={orgSwitcher.switchingContractorId}
              onSelect={target => {
                void orgSwitcher.switchTo(target);
              }}
              variant="sheet"
            />
          </div>
        ) : null}

        <div className="mt-auto p-4">
          <Separator className="mb-4" />
          <div className="mb-3">
            <p className="text-sm font-medium">{contractorName}</p>
            <p className="text-xs text-muted-foreground">{contractorEmail}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="me-2 h-4 w-4" />
            {t('signOut')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
