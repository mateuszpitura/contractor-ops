// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — Classification compliance dashboard page.
// ---------------------------------------------------------------------------
//
// Per UI-SPEC D-13: two market cards (GB IR35 + DE Scheinselbständigkeit)
// stacked vertically with 4 tiles each. No tabs — users see both markets at
// once. Global header shows totalContractors / totalActiveEngagements /
// lastScannedAt. Manual refresh button invalidates the classificationDashboard
// React Query cache for ALL tiles. CSV export per market.
//
// Layout: centred 5xl container, 32px vertical gap between cards.

'use client';

import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { MarketCard } from '@/components/contractors/classification/dashboard/market-card';
import { RefreshDashboardButton } from '@/components/contractors/classification/dashboard/refresh-dashboard-button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

function GlobalHeader() {
  const t = useTranslations('Classification.polish.dashboard');
  const formatter = useFormatter();
  const header = useQuery(trpc.classificationDashboard.globalHeader.queryOptions());

  if (!header.data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const { totalContractors, totalActiveEngagements, lastScannedAt } = header.data;
  const lastScannedDisplay = lastScannedAt
    ? formatter.relativeTime(new Date(lastScannedAt), { now: new Date() })
    : t('lastScannedNever');

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      data-testid="classification-dashboard-global-header">
      <div className="flex flex-col gap-1 rounded-lg border bg-surface-1 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('totalContractorsLabel')}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{totalContractors}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border bg-surface-1 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('totalActiveEngagementsLabel')}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{totalActiveEngagements}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border bg-surface-1 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('lastScannedLabel')}
        </span>
        <span className="text-sm font-medium">{lastScannedDisplay}</span>
      </div>
    </div>
  );
}

function ClassificationDashboardContent() {
  const t = useTranslations('Classification.polish.dashboard');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">
          {t('pageH1')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('pageSubline')}</p>
      </header>

      <GlobalHeader />

      <div className="flex justify-end">
        <RefreshDashboardButton />
      </div>

      <div className="flex flex-col gap-8">
        <MarketCard market="GB" />
        <MarketCard market="DE" />
      </div>
    </div>
  );
}

export default function ClassificationDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      }>
      <ClassificationDashboardContent />
    </Suspense>
  );
}
