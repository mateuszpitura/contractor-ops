import type { ClassificationDisclaimerDialogProps } from './classification-disclaimer-dialog.js';
import { ClassificationDisclaimerDialogView } from './classification-disclaimer-dialog.js';
import { useClassificationDisclaimerAck } from './hooks/use-classification-disclaimer.js';

// Decision: dialog host — open/onAcknowledged gated by
// engagement-classification-container; acknowledgeDisclaimer mutation isolated.
export function ClassificationDisclaimerDialogContainer(
  props: ClassificationDisclaimerDialogProps,
) {
  const { acknowledge, isPending } = useClassificationDisclaimerAck(
    props.assessmentId,
    props.onAcknowledged,
  );
  return (
    <ClassificationDisclaimerDialogView
      {...props}
      acknowledge={acknowledge}
      isPending={isPending}
    />
  );
}
