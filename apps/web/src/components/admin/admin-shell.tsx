'use client';

// apps/web/src/components/admin/admin-shell.tsx
//
// Phase 63 · Plan 05 — Admin sidebar shell.
// Currently only "BoE rate" entry. Extensible for future admin pages.

import { BarChart3Icon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function AdminShell() {
  const t = useTranslations('Admin');
  const pathname = usePathname();

  const navEntries = [
    {
      label: t('BoeRate.navLabel'),
      href: '/admin/boe-rate',
      icon: BarChart3Icon,
    },
  ];

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('sidebarHeading')}
        </h2>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navEntries.map(entry => {
            const isActive = pathname.startsWith(entry.href);
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}>
                  <entry.icon className="h-4 w-4" aria-hidden="true" />
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
