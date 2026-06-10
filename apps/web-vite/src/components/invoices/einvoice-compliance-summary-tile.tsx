/**
 * E-invoice compliance summary tile.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertCircle } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import {
  useEinvoiceComplianceSummary,
  type EInvoiceComplianceSummaryData,
} from './hooks/use-einvoice-compliance-summary.js';

export interface EInvoiceComplianceSummaryTileViewProps {
  onReviewFilterRequested?: () => void;
  summary: EInvoiceComplianceSummaryData;
}

function computeCompliancePercent(summary: EInvoiceComplianceSummaryData): number {
  if (summary.total === 0) return 100;
  const compliant = summary.valid + summary.warnings;
  return Math.round((compliant / summary.total) * 100);
}

function kpiColorClass(percent: number): string {
  if (percent >= 95) return 'text-primary';
  if (percent >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

export function EInvoiceComplianceSummaryTileSkeleton() {
  return (
    <Card className="w-full min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-4 p-6">
        <Skeleton className="h-7 w-48 max-w-full" />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
          <Skeleton className="h-10 w-20 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-2/3 max-w-xs" />
          </div>
        </div>
        <Skeleton className="h-2 w-full min-w-0" />
        <div className="flex justify-end">
          <Skeleton className="h-9 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EInvoiceComplianceSummaryTileView({
  onReviewFilterRequested,
  summary,
}: EInvoiceComplianceSummaryTileViewProps) {
  const t = useTranslations('EInvoice.InvoicesList.SummaryTile');

  const handleReviewClick = useCallback(() => {
    onReviewFilterRequested?.();
  }, [onReviewFilterRequested]);

  const validCount = summary.valid + summary.warnings;
  const needsAttentionCount = summary.invalid + summary.failed;
  const percent = computeCompliancePercent(summary);

  return (
    <Card className="w-full min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-4 p-6">
        <h2 className="min-w-0 text-xl font-display font-semibold leading-snug">{t('heading')}</h2>

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            data-testid="einvoice-compliance-kpi"
            className={`shrink-0 text-3xl font-semibold tabular-nums ${kpiColorClass(percent)}`}>
            {percent}%
          </span>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t('bodyPattern', { validCount, totalCount: summary.total })}
          </p>
        </div>

        <div className="w-full min-w-0">
          <Progress className="w-full min-w-0" value={percent} aria-label={t('heading')} />
        </div>

        {needsAttentionCount > 0 ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReviewClick}>
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {t('ctaNeedsAttention', { needsAttentionCount })}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface EInvoiceComplianceSummaryTileProps {
  onReviewFilterRequested?: () => void;
}

export function EInvoiceComplianceSummaryTile({
  onReviewFilterRequested,
}: EInvoiceComplianceSummaryTileProps) {
  const { isLoading, summary } = useEinvoiceComplianceSummary();

  if (isLoading) return <EInvoiceComplianceSummaryTileSkeleton />;

  return (
    <EInvoiceComplianceSummaryTileView
      summary={summary}
      onReviewFilterRequested={onReviewFilterRequested}
    />
  );
}
