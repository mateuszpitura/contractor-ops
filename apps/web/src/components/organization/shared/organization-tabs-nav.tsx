'use client';

// Client-rendered tab bar shared across /organization/*. Uses the pathname so
// the active tab tracks the current sub-route (server-rendered layout above
// owns the heading + container chrome).

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

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
  const active = useSelectedLayoutSegment();

  return (
    <nav aria-label="Organization tabs" className="border-border flex gap-1 border-b">
      {TABS.map(tab => {
        const isActive = active === tab.segment;
        return (
          <Link
            key={tab.segment}
            href={tab.href}
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
