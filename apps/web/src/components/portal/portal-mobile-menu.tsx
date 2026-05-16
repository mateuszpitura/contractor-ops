'use client';

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
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { LooseTranslator } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Navigation items (same as top bar)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
  if (href === '/portal') {
    return path === '/portal' || path === '/portal/';
  }
  return path.startsWith(href);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PortalMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  contractorName: string;
  contractorEmail: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Mobile navigation menu for the portal.
 * Uses Sheet (slide from right) per UI-SPEC D-03.
 * Full-width nav links with active highlighting,
 * contractor info, and sign out at the bottom.
 */
export function PortalMobileMenu({
  open,
  onOpenChange,
  orgName,
  contractorName,
  contractorEmail,
}: PortalMobileMenuProps) {
  const tAria = useTranslations('Common.aria');
  const t = useTranslations('Portal.nav');
  const pathname = usePathname();
  const router = useRouter();

  const NAV_ITEMS = getNavItems(t);

  const handleNavClick = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const handleLogout = async () => {
    onOpenChange(false);
    try {
      await fetch('/api/portal/clear-session', { method: 'POST' });
    } finally {
      router.push('/portal/login');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{orgName}</SheetTitle>
          <SheetDescription className="sr-only">{t('menuDescription')}</SheetDescription>
        </SheetHeader>

        {/* Navigation links */}
        <nav className="flex flex-col flex-1" aria-label={tAria('mobilePortalNavigation')}>
          {NAV_ITEMS.map(item => {
            const active = isNavActive(item.href, pathname);
            return (
              <button
                key={item.href}
                type="button"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => handleNavClick(item.href)}
                className={cn(
                  'flex items-center gap-3 border-b px-4 py-3 text-base transition-colors text-start',
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

        {/* Bottom: Contractor info + sign out */}
        <div className="mt-auto p-4">
          <Separator className="mb-4" />
          <div className="mb-3">
            <p className="text-sm font-medium">{contractorName}</p>
            <p className="text-xs text-muted-foreground">{contractorEmail}</p>
          </div>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="me-2 h-4 w-4" />
            {t('signOut')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
