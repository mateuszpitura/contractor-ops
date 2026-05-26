import { useIntakeDetailActions } from '../hooks/use-intake-detail-actions.js';
import { IntakeDetailActionsBar } from './intake-detail-actions-bar.js';
import type { IntakeStatus } from './intake-status-pill.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

interface IntakeDetailActionsBarContainerProps {
  intakeId: string;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  selectedCandidateId: string | null;
  className?: string;
}

// Decision: toolbar host — useIntakeDetailActions returns per-button
// enable/visibility flags consumed inside one IntakeDetailActionsBar render.
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
