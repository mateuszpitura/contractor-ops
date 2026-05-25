import type { ClassificationDisclaimerDialogProps } from './classification-disclaimer-dialog.js';
import { ClassificationDisclaimerDialogView } from './classification-disclaimer-dialog.js';
import { useClassificationDisclaimerAck } from './hooks/use-classification-disclaimer.js';

// Decision: render gated externally by parent (engagement-classification-container
// owns disclaimer-open state). This container's job is to keep the
// acknowledgeDisclaimer mutation out of the presentational view.
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
