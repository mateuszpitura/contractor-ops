'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Router response shape (einvoice.summaryForOrg). Kept as a local alias to
// avoid coupling component code to the generated router type surface.
// ---------------------------------------------------------------------------

interface SummaryData {
  total: number;
  notGenerated: number;
  valid: number;
  warnings: number;
  invalid: number;
  transmitted: number;
  failed: number;
}

interface EInvoiceComplianceSummaryTileProps {
  /**
   * Called when the "Review N invoices" CTA is clicked. Sets the filter
   * chips to a multi-select of invalid + failed.
   */
  onReviewFilterRequested?: () => void;
}

function computeCompliancePercent(summary: SummaryData): number {
  if (summary.total === 0) return 100;
  const compliant = summary.valid + summary.warnings;
  return Math.round((compliant / summary.total) * 100);
}

function kpiColorClass(percent: number): string {
  if (percent >= 95) return 'text-primary';
  if (percent >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

/**
 * Summary tile pinned above the invoices table. Surfaces org-wide
 * EN 16931 compliance as:
 *
 * - A display KPI numeral (`text-3xl` / accent-coloured when ≥95%).
 * - A `progress` bar (single `--primary` fill on `--muted` track).
 * - A body line "X of Y invoices are EN 16931 compliant".
 * - A "Review N invoice(s)" CTA when invalid + failed > 0.
 *
 * Data source: `trpc.einvoice.summaryForOrg` (Plan 06 router).
 */
export function EInvoiceComplianceSummaryTile({
  onReviewFilterRequested,
}: EInvoiceComplianceSummaryTileProps = {}) {
  const t = useTranslations('EInvoice.InvoicesList.SummaryTile');
  const query = useQuery(trpc.einvoice.summaryForOrg.queryOptions());

  const handleReviewClick = useCallback(() => {
    onReviewFilterRequested?.();
  }, [onReviewFilterRequested]);

  if (query.isLoading) {
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

  const summary = (query.data as SummaryData | undefined) ?? {
    total: 0,
    notGenerated: 0,
    valid: 0,
    warnings: 0,
    invalid: 0,
    transmitted: 0,
    failed: 0,
  };

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
            {t('bodyPattern', {
              validCount,
              totalCount: summary.total,
            })}
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
