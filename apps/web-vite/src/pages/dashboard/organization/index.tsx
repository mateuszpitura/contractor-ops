import { Building2, Layers, Wallet } from 'lucide-react';

import { useOrganizationIndex } from '../../../components/organization/hooks/use-organization-index.js';
import { OrganizationLayout } from '../../../components/organization/organization-layout.js';
import type { SummaryCardItem } from '../../../components/organization/organization-index-view.js';
import {
  OrganizationIndexSkeleton,
  OrganizationIndexView,
} from '../../../components/organization/organization-index-view.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function OrganizationIndexPageContent() {
  const t = useTranslations('Organization');
  const { isLoading, teamsCount, projectsCount, costCentersCount } = useOrganizationIndex();

  if (isLoading) {
    return (
      <OrganizationLayout>
        <OrganizationIndexSkeleton />
      </OrganizationLayout>
    );
  }

  const items: SummaryCardItem[] = [
    { href: '/organization/teams', label: t('summaryTeams'), count: teamsCount, icon: Building2 },
    {
      href: '/organization/projects',
      label: t('summaryProjects'),
      count: projectsCount,
      icon: Layers,
    },
    {
      href: '/organization/cost-centers',
      label: t('summaryCostCenters'),
      count: costCentersCount,
      icon: Wallet,
    },
  ];

  return (
    <OrganizationLayout>
      <OrganizationIndexView items={items} />
    </OrganizationLayout>
  );
}

export default function OrganizationIndexPage() {
  return <OrganizationIndexPageContent />;
}
