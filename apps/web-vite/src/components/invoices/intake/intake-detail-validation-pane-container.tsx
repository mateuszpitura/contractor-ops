import { useIntakeDetailValidation } from '../hooks/use-intake-detail-validation.js';
import { IntakeDetailValidationPane } from './intake-detail-validation-pane.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

// Decision: section always renders the same card shape — the parent
// `IntakeDetailClient` already owns the intake-level loading/error gate and
// passes the validation status, issues, and ack timestamp in as props.
// The hook only supplies the `openReport` async action and its pending
// flag, so there is no full-view variant to pick. Container exists to keep
// the `downloadValidationReport` query inside the invoices folder.

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
