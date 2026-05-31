import { usePaymentRunStepReview } from '../hooks/use-payment-run-step-review.js';
import { PaymentBlockModal } from '../payment-block-modal.js';
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

// Decision: mutation host — usePaymentRunStepReview owns create +
// lock-and-export mutations and the isLocking guard. selectedInvoiceIds
// forwarded by NewPaymentRunDialogContainer; no variant flag.
export function StepReviewContainer(props: StepReviewContainerProps) {
  const review = usePaymentRunStepReview({
    selectedInvoiceIds: props.selectedInvoiceIds,
    groupByCurrency: props.groupByCurrency,
    onComplete: props.onComplete,
  });
  return (
    <>
      <StepReview {...props} review={review} />
      <PaymentBlockModal
        open={review.paymentBlock.open}
        onClose={review.dismissPaymentBlock}
        contractorReasons={review.paymentBlock.reasons}
      />
    </>
  );
}
