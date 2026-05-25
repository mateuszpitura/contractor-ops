import { useNewPaymentRunDialog } from '../hooks/use-new-payment-run-dialog.js';
import { NewPaymentRunDialogView } from './new-payment-run-dialog-view.js';

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

  return (
    <NewPaymentRunDialogView
      open={dialog.open}
      step={dialog.step}
      setStep={dialog.setStep}
      selectedInvoiceIds={dialog.selectedInvoiceIds}
      setSelectedInvoiceIds={dialog.setSelectedInvoiceIds}
      groupByCurrency={dialog.groupByCurrency}
      setGroupByCurrency={dialog.setGroupByCurrency}
      confirmationData={dialog.confirmationData}
      handleOpenChange={dialog.handleOpenChange}
      handleComplete={dialog.handleComplete}
      onViewRunFromConfirmation={dialog.handleViewRunFromConfirmation}
      onClose={dialog.handleClose}
    />
  );
}
