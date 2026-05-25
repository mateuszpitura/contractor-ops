import { useIntakeDetailActions } from '../hooks/use-intake-detail-actions.js';
import { IntakeDetailActionsBar } from './intake-detail-actions-bar.js';
import type { IntakeStatus } from './intake-status-pill.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

// Toolbar always renders. Individual button visibility (showAccept,
// canReject, showConfirmMatch, canConvert) is derived from intake status
// flags inside the hook and toggles inline buttons in a single toolbar
// view — not a variant pick. Container stays thin to keep the hook
// boundary inside the invoices folder.

interface IntakeDetailActionsBarContainerProps {
  intakeId: string;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  selectedCandidateId: string | null;
  className?: string;
}

export function IntakeDetailActionsBarContainer(props: IntakeDetailActionsBarContainerProps) {
  const actions = useIntakeDetailActions(
    props.intakeId,
    props.status,
    props.validationStatus,
    props.validationAcknowledgedAt,
    props.selectedCandidateId,
  );

  return <IntakeDetailActionsBar {...props} actions={actions} />;
}
