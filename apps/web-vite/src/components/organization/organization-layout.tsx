/**
 * Organization section chrome — Step 10 batch 6 port from
 * apps/web/src/app/[locale]/(dashboard)/organization/layout.tsx:
 *   - `next-intl` server `getTranslations` → client `useTranslations`
 */

import { Network } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { OrganizationTabsNav } from './shared/organization-tabs-nav.js';

interface OrganizationLayoutProps {
  children: ReactNode;
}

export function OrganizationLayout({ children }: OrganizationLayoutProps) {
  const t = useTranslations('Organization');

  return (
    <div className="container mx-auto flex min-h-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-3">
          <Network className="text-muted-foreground h-6 w-6" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">{t('subtitle')}</p>
      </header>
      <div className="shrink-0">
        <OrganizationTabsNav />
      </div>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
