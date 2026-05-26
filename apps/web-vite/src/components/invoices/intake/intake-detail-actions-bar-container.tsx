import { useIntakeDetailActions } from '../hooks/use-intake-detail-actions.js';
import { IntakeDetailActionsBar } from './intake-detail-actions-bar.js';
import type { IntakeStatus } from './intake-status-pill.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

// Decision: mutation-host toolbar that always renders the same shape — the
// parent `IntakeDetailClient` owns the loading/error gate for the intake
// itself. The hook returns per-button enable/visibility flags
// (`showAccept`, `canReject`, `showConfirmMatch`, `canConvert`) which toggle
// inline buttons inside a single toolbar, so there is no full-view variant
// to pick. Container exists to keep the four mutations
// (`convertToInvoice`, `confirmMatch`, `acknowledgeValidation`, `reject`)
// inside the invoices folder.

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
