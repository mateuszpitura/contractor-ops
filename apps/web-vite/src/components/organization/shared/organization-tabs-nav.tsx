/**
 * Organization tab bar. Step 11 codemod port from
 * apps/web/src/components/organization/shared/organization-tabs-nav.tsx:
 *   - `next/link`                  → `react-router-dom#Link`
 *   - `next/navigation#useSelectedLayoutSegment` →
 *     `react-router-dom#useMatch` (matches the leaf segment of the active
 *     route); the legacy hook returns the last segment of the URL
 *     relative to the layout, the new version inspects the pathname.
 *   - `next-intl`                  → `../../../i18n/useTranslations.js`
 *   - `@/lib/utils`                → `../../../lib/utils.js`
 */

import { Link, useLocation } from 'react-router-dom';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

interface OrganizationTab {
  segment: 'teams' | 'projects' | 'cost-centers';
  href: string;
  i18nKey: 'tabTeams' | 'tabProjects' | 'tabCostCenters';
}

const TABS: OrganizationTab[] = [
  { segment: 'teams', href: 'teams', i18nKey: 'tabTeams' },
  { segment: 'projects', href: 'projects', i18nKey: 'tabProjects' },
  { segment: 'cost-centers', href: 'cost-centers', i18nKey: 'tabCostCenters' },
];

export function OrganizationTabsNav() {
  const t = useTranslations('Organization');
  const location = useLocation();
  // Match the last path segment under /<locale>/organization/...
  const activeSegment = location.pathname.split('/').filter(Boolean).at(-1);

  return (
    <nav aria-label="Organization tabs" className="border-border flex gap-1 border-b">
      {TABS.map(tab => {
        const isActive = activeSegment === tab.segment;
        return (
          <Link
            key={tab.segment}
            to={tab.href}
            relative="path"
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}>
            {t(tab.i18nKey)}
          </Link>
        );
      })}
    </nav>
  );
}
