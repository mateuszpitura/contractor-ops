/**
 * Organization section chrome — Step 10 batch 6 port from
 * apps/web/src/app/[locale]/(dashboard)/organization/layout.tsx:
 *   - `next-intl` server `getTranslations` → client `useTranslations`
 *
 * Layout matches other workbench list pages (contractors, workflows, time):
 * full-width `WORKBENCH_TABLE_PAGE_CLASS`, `WorkbenchPageHeader`, route tabs.
 */

import { WORKBENCH_TABLE_PAGE_CLASS } from '@contractor-ops/ui';
import type { ReactNode } from 'react';

import { usePathname } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { OrganizationTabsNav } from './shared/organization-tabs-nav.js';

interface OrganizationLayoutProps {
  children: ReactNode;
}

function isOrganizationIndexPath(pathname: string): boolean {
  return pathname === '/organization' || pathname === '/organization/';
}

export function OrganizationLayout({ children }: OrganizationLayoutProps) {
  const t = useTranslations('Organization');
  const pathname = usePathname();
  const showTabs = !isOrganizationIndexPath(pathname);

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} description={t('subtitle')} />
      </AnimateIn>

      {showTabs ? (
        <AnimateIn delay={1}>
          <OrganizationTabsNav />
        </AnimateIn>
      ) : null}

      <AnimateIn delay={showTabs ? 2 : 1} className="flex min-h-0 flex-1 flex-col">
        {children}
      </AnimateIn>
    </div>
  );
}
