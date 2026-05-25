import { useRecomputeCompliance } from '../hooks/use-recompute-compliance.js';
import type { RecomputeComplianceDialogProps } from './recompute-compliance-dialog.js';
import { RecomputeComplianceDialogView } from './recompute-compliance-dialog.js';

// Decision: render gated externally by parent (recompute-compliance-button owns
// open state). Container's job is to keep the recompute mutation out of the view.
export function RecomputeComplianceDialogContainer(props: RecomputeComplianceDialogProps) {
  const { mutation, isPending } = useRecomputeCompliance(props.onSuccess);
  return <RecomputeComplianceDialogView {...props} mutation={mutation} isPending={isPending} />;
}
