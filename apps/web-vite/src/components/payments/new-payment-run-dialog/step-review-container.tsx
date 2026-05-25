import { usePaymentRunStepReview } from '../hooks/use-payment-run-step-review.js';
import { StepReview } from './step-review.js';

interface StepReviewContainerProps {
  selectedInvoiceIds: string[];
  groupByCurrency: boolean;
  onBack: () => void;
  onComplete: (result: {
    runId: string;
    runNumber: string;
    fileBase64: string;
    fileName: string;
    invoiceCount: number;
    totalMinor: number;
    currency: string;
    exportFormat: string;
  }) => void;
}

/**
 * Decision rule annotation — mutation-host container.
 *
 * Hook owns the create + lock-and-export tRPC mutations, debounced
 * react-query state, and the `isLocking` pending guard. The view is a
 * single render path: there is no loading/error/empty variant because
 * the data the hook needs (selected invoice ids) is provided by the
 * parent dialog. `isLocking` is local action state, not a data-load
 * branch. Kept as a passthrough — no decision belongs here.
 */
export function StepReviewContainer(props: StepReviewContainerProps) {
  const review = usePaymentRunStepReview({
    selectedInvoiceIds: props.selectedInvoiceIds,
    groupByCurrency: props.groupByCurrency,
    onComplete: props.onComplete,
  });
  return <StepReview {...props} review={review} />;
}
