import { useRecomputeCompliance } from '../hooks/use-recompute-compliance.js';
import type { RecomputeComplianceDialogProps } from './recompute-compliance-dialog.js';
import { RecomputeComplianceDialogView } from './recompute-compliance-dialog.js';

// Decision: dialog host — open/onSuccess gated by RecomputeComplianceButton;
// useRecomputeCompliance mutation isolated from view.
export function RecomputeComplianceDialogContainer(props: RecomputeComplianceDialogProps) {
  const { mutation, isPending } = useRecomputeCompliance(props.onSuccess);
  return <RecomputeComplianceDialogView {...props} mutation={mutation} isPending={isPending} />;
}
