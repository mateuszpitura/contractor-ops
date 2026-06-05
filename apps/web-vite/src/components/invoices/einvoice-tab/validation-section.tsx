/**
 * Validation section.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Loader2, ShieldQuestion } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SvrlIssueList } from './svrl-issue-list.js';
import type { EInvoiceLifecycleShape } from './types.js';
import type { ValidationLayerStatus } from './validation-layer-row.js';
import { ValidationLayerRow } from './validation-layer-row.js';

interface ValidationSectionProps {
  lifecycle: EInvoiceLifecycleShape | null;
  isRevalidatePending: boolean;
  isDownloadReportPending: boolean;
  onRevalidate: () => void;
  onDownloadReport: () => void;
}

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
