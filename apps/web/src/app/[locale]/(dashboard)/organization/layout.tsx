// Shared layout for /organization/* — tab bar across Teams / Projects / Cost Centers.

import { Network } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { OrganizationTabsNav } from '@/components/organization/shared/organization-tabs-nav';

interface OrganizationLayoutProps {
  children: ReactNode;
}

export default async function OrganizationLayout({ children }: OrganizationLayoutProps) {
  const t = await getTranslations('Organization');
  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Network className="text-muted-foreground h-6 w-6" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">{t('subtitle')}</p>
      </header>
      <OrganizationTabsNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
