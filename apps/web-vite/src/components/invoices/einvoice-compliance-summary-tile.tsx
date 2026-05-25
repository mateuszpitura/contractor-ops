/**
 * E-invoice compliance summary tile. Step 11 codemod port from
 * apps/web/src/components/invoices/einvoice-compliance-summary-tile.tsx:
 *   - `next-intl`     → `../../i18n/useTranslations.js`
 *   - `@/trpc/init`   → `../../providers/trpc-provider.js#useTRPC`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertCircle } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { EInvoiceComplianceSummaryData } from './hooks/use-einvoice-compliance-summary.js';

interface EInvoiceComplianceSummaryTileProps {
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
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <Skeleton className="h-7 w-48" />
        <div className="flex items-baseline gap-4">
          <Skeleton className="h-10 w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-2/3 max-w-xs" />
          </div>
        </div>
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-9 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EInvoiceComplianceSummaryTile({
  onReviewFilterRequested,
  summary,
}: EInvoiceComplianceSummaryTileProps) {
  const t = useTranslations('EInvoice.InvoicesList.SummaryTile');

  const handleReviewClick = useCallback(() => {
    onReviewFilterRequested?.();
  }, [onReviewFilterRequested]);

  const validCount = summary.valid + summary.warnings;
  const needsAttentionCount = summary.invalid + summary.failed;
  const percent = computeCompliancePercent(summary);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h2 className="text-xl font-display font-semibold">{t('heading')}</h2>

        <div className="flex items-baseline gap-4">
          <span
            data-testid="einvoice-compliance-kpi"
            className={`text-3xl font-semibold tabular-nums ${kpiColorClass(percent)}`}>
            {percent}%
          </span>
          <p className="text-sm text-muted-foreground">
            {t('bodyPattern', { validCount, totalCount: summary.total })}
          </p>
        </div>

        <Progress value={percent} aria-label={t('heading')} />

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
