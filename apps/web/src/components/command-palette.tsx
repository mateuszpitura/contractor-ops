'use client';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@contractor-ops/ui/components/shadcn/command';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  CircleDollarSign,
  FileText,
  HelpCircle,
  Languages,
  LayoutDashboard,
  Moon,
  Receipt,
  Search,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface RouteShortcut {
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'nav' | 'finance' | 'team';
  shortcut?: string;
}

const ROUTES: ReadonlyArray<RouteShortcut> = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'nav', shortcut: 'G D' },
  { label: 'Contractors', href: '/contractors', icon: Users, group: 'team', shortcut: 'G C' },
  { label: 'Equipment', href: '/equipment', icon: Settings, group: 'team', shortcut: 'G E' },
  { label: 'Contracts', href: '/contracts', icon: FileText, group: 'finance', shortcut: 'G T' },
  { label: 'Invoices', href: '/invoices', icon: Receipt, group: 'finance', shortcut: 'G I' },
  {
    label: 'Payments',
    href: '/payments',
    icon: CircleDollarSign,
    group: 'finance',
    shortcut: 'G P',
  },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays, group: 'nav' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'nav', shortcut: 'G S' },
  { label: 'Help', href: '/help', icon: HelpCircle, group: 'nav' },
];

const LOCALES = ['en', 'pl', 'de', 'ar'] as const;

// Match only our supported locale prefixes — a naive `/^\/[a-z]{2}/` would
// strip arbitrary two-letter path segments (e.g. `/io/`) and route the
// user somewhere weird.
const LOCALE_PREFIX_RE = new RegExp(`^\\/(?:${LOCALES.join('|')})(?=\\/|$)`);

interface CommandPaletteProps {
  /** Optional preselected query (server-side, e.g. /search). Empty by default. */
  initialQuery?: string;
}

export function CommandPalette({ initialQuery = '' }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('commandPalette');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(open => !open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const goTo = useCallback(
    (href: string) => {
      router.push(`/${locale}${href}`);
      setOpen(false);
    },
    [locale, router],
  );

  const switchLocale = useCallback(
    (nextLocale: string) => {
      if (typeof window === 'undefined') {
        return;
      }
      const path = window.location.pathname.replace(LOCALE_PREFIX_RE, '');
      router.push(`/${nextLocale}${path}`);
      setOpen(false);
    },
    [router],
  );

  const groupedRoutes = useMemo(() => {
    return {
      nav: ROUTES.filter(r => r.group === 'nav'),
      finance: ROUTES.filter(r => r.group === 'finance'),
      team: ROUTES.filter(r => r.group === 'team'),
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
        <Search aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t('open')}</span>
        <kbd className="ms-2 hidden rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t('placeholder')} value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{t('empty')}</CommandEmpty>
          <CommandGroup heading={t('groups.navigate')}>
            {groupedRoutes.nav.map(route => (
              <CommandItem key={route.href} value={route.label} onSelect={() => goTo(route.href)}>
                <route.icon aria-hidden className="me-2 size-4 text-muted-foreground" />
                {route.label}
                {route.shortcut ? <CommandShortcut>{route.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t('groups.team')}>
            {groupedRoutes.team.map(route => (
              <CommandItem key={route.href} value={route.label} onSelect={() => goTo(route.href)}>
                <route.icon aria-hidden className="me-2 size-4 text-muted-foreground" />
                {route.label}
                {route.shortcut ? <CommandShortcut>{route.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t('groups.finance')}>
            {groupedRoutes.finance.map(route => (
              <CommandItem key={route.href} value={route.label} onSelect={() => goTo(route.href)}>
                <route.icon aria-hidden className="me-2 size-4 text-muted-foreground" />
                {route.label}
                {route.shortcut ? <CommandShortcut>{route.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t('groups.preferences')}>
            <CommandItem onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? (
                <Sun aria-hidden className="me-2 size-4" />
              ) : (
                <Moon aria-hidden className="me-2 size-4" />
              )}
              {theme === 'dark' ? t('theme.light') : t('theme.dark')}
            </CommandItem>
            {LOCALES.map(code => (
              <CommandItem
                key={code}
                value={`Switch to ${code}`}
                onSelect={() => switchLocale(code)}>
                <Languages aria-hidden className="me-2 size-4" />
                {t('locale.switchTo', { locale: code.toUpperCase() })}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
