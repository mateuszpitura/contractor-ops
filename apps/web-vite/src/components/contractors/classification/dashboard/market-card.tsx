/**
 * Per-market classification dashboard card.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import type { useClassificationMarketCard } from '../hooks/use-classification-dashboard.js';
import { ActiveAlertsTile } from './active-alerts-tile.js';
import { CoverageTile } from './coverage-tile.js';
import { DownloadCsvButtonContainer } from './download-csv-button-container.js';
import { OverdueReassessmentsTile } from './overdue-reassessments-tile.js';
import { RiskDistributionTile } from './risk-distribution-tile.js';

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

export type MarketCardViewProps = MarketCardProps & ReturnType<typeof useClassificationMarketCard>;

export function MarketCardView({
  market,
  coverage,
  riskDistribution,
  overdue,
  activeAlerts,
}: MarketCardViewProps) {
  const t = useTranslations('Classification.polish.dashboard');

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
          <DownloadCsvButtonContainer market={market} />
        </div>
      </CardContent>
    </Card>
  );
}
