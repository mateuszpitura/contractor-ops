'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Layers, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { trpc } from '@/trpc/init';

interface SummaryCardProps {
  href: string;
  label: string;
  count: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
}

function SummaryCard({ href, label, count, icon: Icon }: SummaryCardProps) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring rounded-lg focus-visible:outline-none focus-visible:ring-2">
      <Card className="hover:border-foreground/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent className="flex items-end justify-between">
          <div className="text-2xl font-semibold tabular-nums">{count ?? '—'}</div>
          <ArrowRight className="text-muted-foreground h-4 w-4" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function OrganizationLandingPage() {
  const t = useTranslations('Organization');
  const teams = useQuery(trpc.organizationDefinitions.team.list.queryOptions({ limit: 1 }));
  const projects = useQuery(trpc.organizationDefinitions.project.list.queryOptions({ limit: 1 }));
  const costCenters = useQuery(
    trpc.organizationDefinitions.costCenter.list.queryOptions({ limit: 1 }),
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SummaryCard
        href="/organization/teams"
        label={t('summaryTeams')}
        count={teams.data?.items.length}
        icon={Building2}
      />
      <SummaryCard
        href="/organization/projects"
        label={t('summaryProjects')}
        count={projects.data?.items.length}
        icon={Layers}
      />
      <SummaryCard
        href="/organization/cost-centers"
        label={t('summaryCostCenters')}
        count={costCenters.data?.items.length}
        icon={Wallet}
      />
    </div>
  );
}
