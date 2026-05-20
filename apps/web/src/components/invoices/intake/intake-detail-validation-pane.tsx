'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { ValidationStatus } from './intake-validation-status-pill';
import { IntakeValidationStatusPill } from './intake-validation-status-pill';

interface ValidationIssue {
  severity: 'warning' | 'fatal' | 'info' | string;
  ruleId?: string | null;
  message?: string | null;
  xpath?: string | null;
}

interface IntakeDetailValidationPaneProps {
  intakeId: string;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  validationReportSummary: ValidationIssue[] | null;
  totalIssueCount?: number;
  className?: string;
}

/**
 * Validation-report pane. Surfaces the layer-3 KoSIT outcome (VALID /
 * WARNINGS / INVALID), a count of issues, a "Open full report" button
 * that fetches a signed R2 URL to the raw HTML report, and an inline
 * list of the first 5 schematron issues.
 */
export function IntakeDetailValidationPane({
  intakeId,
  validationStatus,
  validationAcknowledgedAt,
  validationReportSummary,
  totalIssueCount,
  className,
}: IntakeDetailValidationPaneProps) {
  const t = useTranslations('EInvoice.intake');
  const tValidation = useTranslations('EInvoice.intake.validation');
  const format = useFormatter();
  const [reportLoading, setReportLoading] = useState(false);

  const openReport = useCallback(async () => {
    setReportLoading(true);
    try {
      // We use `useQuery`-cached fetches elsewhere; here we want a one-shot
      // on-click load so the signed URL is always fresh (300 s TTL).
      const response = await fetch(
        `/api/trpc/invoiceIntake.downloadValidationReport?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: { intakeId } } }))}`,
      );
      const json = (await response.json()) as Array<{
        result?: { data?: { json?: { url?: string } } };
      }>;
      const url = json?.[0]?.result?.data?.json?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setReportLoading(false);
    }
  }, [intakeId]);

  const issues = validationReportSummary ?? [];
  const firstFive = issues.slice(0, 5);
  const count = totalIssueCount ?? issues.length;

  return (
    <Card className={className} data-slot="intake-detail-validation-pane">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">
          <span className="me-2">Validation</span>
          {validationStatus && <IntakeValidationStatusPill status={validationStatus} />}
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={openReport}
          disabled={reportLoading}
          data-testid="intake-open-report">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('openFullReport')}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {count > 0 && (
          <p className="text-sm text-muted-foreground">
            {tValidation('issuesCountPattern', { count })}
          </p>
        )}

        {validationAcknowledgedAt && (
          <div className="rounded-md border border-warning/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            {t('issuesAcceptedPattern', {
              date: format.dateTime(new Date(validationAcknowledgedAt), 'short'),
            })}
          </div>
        )}

        {firstFive.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {firstFive.map((issue, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable order from server
              <li key={`issue-${index}`} className="rounded-md border p-2">
                <span className="me-2 font-mono text-[10px] uppercase">[{issue.severity}]</span>
                {issue.ruleId && <span className="me-2 font-mono">{issue.ruleId}</span>}
                <span>{issue.message ?? ''}</span>
                {issue.xpath && (
                  <code className="ms-2 block text-[10px] text-muted-foreground">
                    {issue.xpath}
                  </code>
                )}
              </li>
            ))}
          </ul>
        ) : (
          validationStatus === 'VALID' && (
            <p className="text-sm text-muted-foreground">{tValidation('VALID')}</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
