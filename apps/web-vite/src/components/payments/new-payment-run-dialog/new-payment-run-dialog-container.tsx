import { useCallback } from 'react';

import { useNewPaymentRunDialog } from '../hooks/use-new-payment-run-dialog.js';
import { NewPaymentRunDialogView } from './new-payment-run-dialog-view.js';
import { StepConfirmation } from './step-confirmation.js';
import { StepReviewContainer } from './step-review-container.js';
import { StepSelectContainer } from './step-select-container.js';

interface NewPaymentRunDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewRun?: (runId: string) => void;
}

export function NewPaymentRunDialogContainer({
  open,
  onOpenChange,
  onViewRun,
}: NewPaymentRunDialogContainerProps) {
  const dialog = useNewPaymentRunDialog({ open, onOpenChange, onViewRun });

  const handleCancelFromSelect = useCallback(() => dialog.handleOpenChange(false), [dialog]);
  const handleNextFromSelect = useCallback(() => dialog.setStep(2), [dialog]);
  const handleBackFromReview = useCallback(() => dialog.setStep(1), [dialog]);

  return (
    <NewPaymentRunDialogView
      open={dialog.open}
      step={dialog.step}
      onOpenChange={dialog.handleOpenChange}>
      {dialog.step === 1 && (
        <StepSelectContainer
          selectedInvoiceIds={dialog.selectedInvoiceIds}
          onSelectionChange={dialog.setSelectedInvoiceIds}
          groupByCurrency={dialog.groupByCurrency}
          onGroupByCurrencyChange={dialog.setGroupByCurrency}
          onCancel={handleCancelFromSelect}
          onNext={handleNextFromSelect}
        />
      )}

      {dialog.step === 2 && (
        <StepReviewContainer
          selectedInvoiceIds={dialog.selectedInvoiceIds}
          groupByCurrency={dialog.groupByCurrency}
          onBack={handleBackFromReview}
          onComplete={dialog.handleComplete}
        />
      )}

      {dialog.step === 3 && dialog.confirmationData && (
        <StepConfirmation
          {...dialog.confirmationData}
          onViewRun={dialog.handleViewRunFromConfirmation}
          onClose={dialog.handleClose}
        />
      )}
    </NewPaymentRunDialogView>
  );
}
