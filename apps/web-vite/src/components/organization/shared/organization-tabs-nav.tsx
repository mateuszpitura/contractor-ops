/**
 * Organization tab bar. Step 11 codemod port from
 * apps/web/src/components/organization/shared/organization-tabs-nav.tsx:
 *   - `next/link`                  → the i18n `Link` wrapper which mounts
 *     react-router's Link and resolves `href` against the active locale.
 *   - `next/navigation#useSelectedLayoutSegment` →
 *     `react-router-dom#useLocation` (matches the leaf segment of the
 *     active route).
 *   - `next-intl`                  → `../../../i18n/useTranslations.js`
 *   - `@/lib/utils`                → `../../../lib/utils.js`
 *
 * Hrefs are absolute (not `relative="path"`) so navigating between tabs
 * never appends `/teams` onto a sibling tab URL: react-router v7's
 * path-relative resolution treats a no-trailing-slash URL as a
 * directory, which on `/organization/projects` made `to="teams"` resolve
 * to `/organization/projects/teams` instead of `/organization/teams`.
 * Absolute hrefs side-step the whole ambiguity.
 */

import { Tabs, TabsList, tabsTriggerClassName } from '@contractor-ops/ui/components/shadcn/tabs';
import { useLocation } from 'react-router-dom';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

interface OrganizationTab {
  segment: 'teams' | 'projects' | 'cost-centers';
  href: string;
  i18nKey: 'tabTeams' | 'tabProjects' | 'tabCostCenters';
}

const TABS: OrganizationTab[] = [
  { segment: 'teams', href: '/organization/teams', i18nKey: 'tabTeams' },
  { segment: 'projects', href: '/organization/projects', i18nKey: 'tabProjects' },
  { segment: 'cost-centers', href: '/organization/cost-centers', i18nKey: 'tabCostCenters' },
];

export function OrganizationTabsNav() {
  const t = useTranslations('Organization');
  const location = useLocation();
  const activeSegment = location.pathname.split('/').filter(Boolean).at(-1);
  const activeValue = TABS.find(tab => tab.segment === activeSegment)?.segment ?? '';

  return (
    <nav aria-label="Organization tabs">
      <Tabs value={activeValue}>
        <TabsList>
          {TABS.map(tab => {
            const isActive = activeSegment === tab.segment;
            return (
              <Link
                key={tab.segment}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                data-slot="tabs-trigger"
                {...(isActive ? { 'data-active': '' } : {})}
                className={cn(tabsTriggerClassName, 'no-underline')}>
                {t(tab.i18nKey)}
              </Link>
            );
          })}
        </TabsList>
      </Tabs>
    </nav>
  );
}
