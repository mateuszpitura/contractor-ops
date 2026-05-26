import { useIntakeDetailValidation } from '../hooks/use-intake-detail-validation.js';
import { IntakeDetailValidationPane } from './intake-detail-validation-pane.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

interface ValidationIssue {
  severity: 'warning' | 'fatal' | 'info' | string;
  ruleId?: string | null;
  message?: string | null;
  xpath?: string | null;
}

interface IntakeDetailValidationPaneContainerProps {
  intakeId: string;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  validationReportSummary: ValidationIssue[] | null;
  totalIssueCount?: number;
  className?: string;
}

// Decision: mutation host — useIntakeDetailValidation exposes openReport +
// reportLoading; parent IntakeDetailClient owns the intake loading/error gate.
export function IntakeDetailValidationPaneContainer(
  props: IntakeDetailValidationPaneContainerProps,
) {
  const { openReport, reportLoading } = useIntakeDetailValidation(props.intakeId);

  return (
    <IntakeDetailValidationPane
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
