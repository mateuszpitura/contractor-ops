// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — MarketCard
// ---------------------------------------------------------------------------
//
// Per-market (GB / DE) compliance card rendering the 4 tiles:
//   coverage / risk distribution / overdue reassessments / active alerts
// plus the DownloadCsvButton CTA per UI-SPEC D-13.
//
// Each tile owns its own tRPC query so loading states are independent —
// slow markets do not block the whole card.

'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { ActiveAlertsTile } from './active-alerts-tile';
import { CoverageTile } from './coverage-tile';
import { DownloadCsvButton } from './download-csv-button';
import { OverdueReassessmentsTile } from './overdue-reassessments-tile';
import { RiskDistributionTile } from './risk-distribution-tile';

export interface MarketCardProps {
  market: 'GB' | 'DE';
}

function TileSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function MarketCard({ market }: MarketCardProps) {
  const t = useTranslations('Classification.polish.dashboard');

  const coverage = trpc.classificationDashboard.coverageByMarket.useQuery({ market });
  const riskDistribution = trpc.classificationDashboard.riskDistributionByMarket.useQuery({
    market,
  });
  const overdue = trpc.classificationDashboard.overdueByMarket.useQuery({ market });
  const activeAlerts = trpc.classificationDashboard.activeAlertsByMarket.useQuery({ market });

  const cardTitle = market === 'GB' ? t('gbCardTitle') : t('deCardTitle');
  const cardSubline = market === 'GB' ? t('gbCardSubline') : t('deCardSubline');

  return (
    <Card data-testid={`market-card-${market.toLowerCase()}`}>
      <CardHeader>
        <CardTitle>
          <span className="font-display text-lg">{cardTitle}</span>
        </CardTitle>
        <CardDescription>{cardSubline}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {coverage.data ? (
            <CoverageTile completed={coverage.data.completed} total={coverage.data.total} />
          ) : (
            <TileSkeleton />
          )}
          {riskDistribution.data ? (
            <RiskDistributionTile
              counts={riskDistribution.data.counts}
              totalCompleted={riskDistribution.data.totalCompleted}
            />
          ) : (
            <TileSkeleton />
          )}
          {overdue.data ? (
            <OverdueReassessmentsTile count={overdue.data.count} items={overdue.data.items} />
          ) : (
            <TileSkeleton />
          )}
          {activeAlerts.data ? (
            market === 'GB' ? (
              <ActiveAlertsTile
                data={{
                  kind: 'gb',
                  openReassessmentTriggers:
                    (activeAlerts.data as { openReassessmentTriggers?: number })
                      .openReassessmentTriggers ?? 0,
                }}
              />
            ) : (
              <ActiveAlertsTile
                data={{
                  kind: 'de',
                  economicBands: (
                    activeAlerts.data as {
                      economicBands?: { warning: number; critical: number };
                    }
                  ).economicBands ?? { warning: 0, critical: 0 },
                  drvExpiringWithin90d:
                    (activeAlerts.data as { drvExpiringWithin90d?: number }).drvExpiringWithin90d ??
                    0,
                }}
              />
            )
          ) : (
            <TileSkeleton />
          )}
        </div>
        <div className="flex justify-end">
          <DownloadCsvButton market={market} />
        </div>
      </CardContent>
    </Card>
  );
}
