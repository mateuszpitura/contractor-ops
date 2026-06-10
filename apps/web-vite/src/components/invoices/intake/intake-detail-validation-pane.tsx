import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ExternalLink } from 'lucide-react';
import { useCallback } from 'react';
import { useIntakeDetailValidation } from '../hooks/use-intake-detail-validation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';
import { IntakeValidationStatusPill } from './intake-validation-status-pill.js';

interface ValidationIssue {
  severity: 'warning' | 'fatal' | 'info' | string;
  ruleId?: string | null;
  message?: string | null;
  xpath?: string | null;
}

export interface IntakeDetailValidationPaneViewProps {
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  validationReportSummary: ValidationIssue[] | null;
  totalIssueCount?: number;
  openReport: () => void | Promise<void>;
  reportLoading: boolean;
  className?: string;
}

export function IntakeDetailValidationPaneView({
  validationStatus,
  validationAcknowledgedAt,
  validationReportSummary,
  totalIssueCount,
  openReport,
  reportLoading,
  className,
}: IntakeDetailValidationPaneViewProps) {
  const t = useTranslations('EInvoice.intake');
  const tValidation = useTranslations('EInvoice.intake.validation');
  const { formatDate } = useDateFormatter();

  const issues = validationReportSummary ?? [];
  const firstFive = issues.slice(0, 5);
  const count = totalIssueCount ?? issues.length;

  const handleOpenReport = useCallback(() => {
    void openReport();
  }, [openReport]);

  return (
    <Card className={className} data-slot="intake-detail-validation-pane">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">
          <span className="me-2">{tValidation('heading')}</span>
          {validationStatus && <IntakeValidationStatusPill status={validationStatus} />}
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleOpenReport}
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
              date: formatDate(validationAcknowledgedAt),
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

export interface IntakeDetailValidationPaneProps {
  intakeId: string;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  validationReportSummary: ValidationIssue[] | null;
  totalIssueCount?: number;
  className?: string;
}

export function IntakeDetailValidationPane(props: IntakeDetailValidationPaneProps) {
  const { openReport, reportLoading } = useIntakeDetailValidation(props.intakeId);

  return (
    <IntakeDetailValidationPaneView
      validationStatus={props.validationStatus}
      validationAcknowledgedAt={props.validationAcknowledgedAt}
      validationReportSummary={props.validationReportSummary}
      totalIssueCount={props.totalIssueCount}
      className={props.className}
      openReport={openReport}
      reportLoading={reportLoading}
    />
  );
}
