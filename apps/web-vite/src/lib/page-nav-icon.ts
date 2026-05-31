import type { LucideIcon } from 'lucide-react';
import { Banknote, BarChart3, FileText, LayoutDashboard, Plug, ShieldCheck } from 'lucide-react';

import { navigationItems } from './navigation.js';
import { PORTAL_NAV_ITEMS } from './portal-navigation.js';
import {
  getSettingsTab,
  getSettingsTabHref,
  isSettingsTabKey,
  SETTINGS_TABS,
} from './settings-tabs.js';

type PageNavIconRoute = { href: string; icon: LucideIcon };

/** Routes with icons not covered by sidebar nav items or settings tab registry. */
const EXTRA_DASHBOARD_ROUTES: PageNavIconRoute[] = [
  { href: '/settings/e-invoicing', icon: Plug },
  { href: '/settings/calendar', icon: Plug },
  { href: '/settings/payments', icon: Banknote },
  { href: '/settings/integrations/zatca', icon: Plug },
  { href: '/portal/signatures', icon: FileText },
  { href: '/admin/boe-rate', icon: BarChart3 },
  { href: '/admin/classification-engine', icon: ShieldCheck },
];

function buildPageNavIconRoutes(): PageNavIconRoute[] {
  const routes: PageNavIconRoute[] = [
    ...navigationItems.map(item => ({ href: item.href, icon: item.icon })),
    ...SETTINGS_TABS.map(tab => ({ href: getSettingsTabHref(tab.key), icon: tab.icon })),
    ...EXTRA_DASHBOARD_ROUTES,
    ...PORTAL_NAV_ITEMS.map(item => ({ href: item.href, icon: item.icon })),
  ];

  const byHref = new Map<string, LucideIcon>();
  for (const route of routes.sort((a, b) => b.href.length - a.href.length)) {
    if (!byHref.has(route.href)) {
      byHref.set(route.href, route.icon);
    }
  }
  return [...byHref.entries()].map(([href, icon]) => ({ href, icon }));
}

const PAGE_NAV_ICON_ROUTES = buildPageNavIconRoutes();

function matchesRoute(pathname: string, href: string, searchParams: URLSearchParams): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  if (href === '/portal') {
    return pathname === '/portal' || pathname === '/portal/';
  }

  const [base, queryPart] = href.split('?');
  if (queryPart) {
    if (pathname !== base) return false;
    const tabFromHref = new URLSearchParams(queryPart).get('tab');
    return tabFromHref !== null && searchParams.get('tab') === tabFromHref;
  }

  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Resolves the Lucide icon for the current page from dashboard sidebar nav,
 * settings tabs, portal nav, or known sub-routes.
 */
export function resolvePageNavIcon(
  pathname: string,
  searchParams: URLSearchParams,
): LucideIcon | undefined {
  if (pathname === '/settings' || pathname === '/settings/') {
    const tab = searchParams.get('tab') ?? 'general';
    if (isSettingsTabKey(tab)) {
      return getSettingsTab(tab).icon;
    }
    return getSettingsTab('general').icon;
  }

  for (const route of PAGE_NAV_ICON_ROUTES) {
    if (matchesRoute(pathname, route.href, searchParams)) {
      return route.icon;
    }
  }

  return;
}

export { LayoutDashboard };
