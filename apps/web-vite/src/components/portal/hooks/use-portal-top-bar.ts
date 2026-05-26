import { useCallback, useState } from 'react';

import { usePathname, useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useOrgSwitcher } from './use-org-switcher.js';
import { usePortalLogout } from './use-portal-settings.js';

export function usePortalTopBar() {
  const tNav = useTranslations('Portal.nav');
  const pathname = usePathname();
  const router = useRouter();
  const orgSwitcher = useOrgSwitcher();
  const logoutMutation = usePortalLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync().catch(() => {
        /* swallowed: clear-session route is the cookie eraser */
      });
      await fetch('/api/portal/clear-session', { method: 'POST' });
    } finally {
      router.push('/portal/login');
    }
  }, [logoutMutation, router]);

  return {
    tNav,
    pathname,
    orgSwitcher,
    mobileMenuOpen,
    setMobileMenuOpen,
    handleLogout,
  } as const;
}

export function usePortalMobileMenu(onOpenChange: (open: boolean) => void) {
  const pathname = usePathname();
  const router = useRouter();
  const orgSwitcher = useOrgSwitcher();

  const handleNavClick = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const handleLogout = useCallback(async () => {
    onOpenChange(false);
    try {
      await fetch('/api/portal/clear-session', { method: 'POST' });
    } finally {
      router.push('/portal/login');
    }
  }, [onOpenChange, router]);

  return {
    pathname,
    orgSwitcher,
    handleNavClick,
    handleLogout,
  } as const;
}
