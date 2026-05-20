'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Loader2, ShieldQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { SvrlIssueList } from './svrl-issue-list';
import type { EInvoiceLifecycleShape } from './types';
import type { ValidationLayerStatus } from './validation-layer-row';
import { ValidationLayerRow } from './validation-layer-row';

interface ValidationSectionProps {
  lifecycle: EInvoiceLifecycleShape | null;
  isRevalidatePending: boolean;
  isDownloadReportPending: boolean;
  onRevalidate: () => void;
  onDownloadReport: () => void;
}

/**
 * Map a layer's summary perLayer record to the UI pill status. Errors
 * beat warnings beat pass.
 */
function mapLayerStatus(
  summaryStatus: string,
  errorCount: number,
  warningCount: number,
): ValidationLayerStatus {
  if (summaryStatus.toLowerCase() === 'skipped') return 'skipped';
  if (errorCount > 0) return 'fail';
  if (warningCount > 0) return 'warnings';
  return 'pass';
}

/**
 * Validation section — 3 layer rows + (optional) SVRL issue list + CTAs
 * (Validate now / Download full report). Empty state when no lifecycle or
 * `NOT_VALIDATED` status.
 */
export function ValidationSection({
  lifecycle,
  isRevalidatePending,
  isDownloadReportPending,
  onRevalidate,
  onDownloadReport,
}: ValidationSectionProps) {
  const t = useTranslations('EInvoice.InvoiceTab');

  const handleRevalidate = useCallback(() => onRevalidate(), [onRevalidate]);
  const handleDownloadReport = useCallback(() => onDownloadReport(), [onDownloadReport]);

  const summary = lifecycle?.validationReportSummary ?? null;
  const hasValidationRun = lifecycle !== null && lifecycle.validationStatus !== 'NOT_VALIDATED';

  // Build per-layer rows (layers 1/2/3) from summary when available.
  const layerRows = summary?.perLayer ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-6" data-slot="validation-section">
        <h3 className="text-xl font-semibold">{t('validationHeading')}</h3>

        {hasValidationRun && summary ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {[1, 2, 3].map(layerNum => {
                const row = layerRows[layerNum - 1];
                const status = row
                  ? mapLayerStatus(row.status, row.errorCount, row.warningCount)
                  : 'skipped';
                return (
                  <ValidationLayerRow
                    key={layerNum}
                    layer={layerNum as 1 | 2 | 3}
                    status={status}
                    errorCount={row?.errorCount ?? 0}
                    warningCount={row?.warningCount ?? 0}
                  />
                );
              })}
            </div>

            <SvrlIssueList issues={summary.issues} />

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRevalidate} disabled={isRevalidatePending}>
                {isRevalidatePending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('validationCta')}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadReport}
                disabled={isDownloadReportPending}>
                {t('downloadReportButton')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('downloadReportHelper')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <ShieldQuestion className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('validationNotValidatedBody')}</p>
            <Button onClick={handleRevalidate} disabled={isRevalidatePending}>
              {isRevalidatePending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('validationCta')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
