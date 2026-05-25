import { useIntakeDetailValidation } from '../hooks/use-intake-detail-validation.js';
import { IntakeDetailValidationPane } from './intake-detail-validation-pane.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

// Section always renders — hook only supplies the `openReport` action and
// its pending flag. Validation status/issues are passed in by the parent
// `IntakeDetailClient`, so there is no loading/empty/error variant to
// pick. Kept as a thin wire-up to keep the hook boundary inside the
// invoices folder.

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
