/**
 * Presentational shell + wired export for the new payment run wizard.
 *
 * `NewPaymentRunDialog` picks the active step content; `NewPaymentRunDialogView`
 * renders the dialog frame + step indicator and yields the body as `children`.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { CreditCard } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useNewPaymentRunDialog } from '../hooks/use-new-payment-run-dialog.js';
import { StepConfirmation } from './step-confirmation.js';
import { StepReview } from './step-review.js';
import { StepSelect } from './step-select.js';

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {[1, 2, 3].map(step => (
        <div
          key={step}
          className={`h-2 w-2 rounded-full transition-colors ${
            step <= currentStep ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );
}

export interface NewPaymentRunDialogViewProps {
  open: boolean;
  step: 1 | 2 | 3;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function NewPaymentRunDialogView({
  open,
  step,
  onOpenChange,
  children,
}: NewPaymentRunDialogViewProps) {
  const t = useTranslations('Payments');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-4" />
            {t('dialog.title')}
          </DialogTitle>
        </DialogHeader>

        <DialogSection>
          <StepIndicator currentStep={step} />
        </DialogSection>

        {/* Each step renders its own DialogBody (scrolls) + DialogFooter
            (sticky) as direct children of DialogContent. */}
        {children}
      </DialogContent>
    </Dialog>
  );
}

interface NewPaymentRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewRun?: (runId: string) => void;
}

export function NewPaymentRunDialog({
  open,
  onOpenChange,
  onViewRun,
}: NewPaymentRunDialogProps) {
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
        <StepSelect
          selectedInvoiceIds={dialog.selectedInvoiceIds}
          onSelectionChange={dialog.setSelectedInvoiceIds}
          groupByCurrency={dialog.groupByCurrency}
          onGroupByCurrencyChange={dialog.setGroupByCurrency}
          onCancel={handleCancelFromSelect}
          onNext={handleNextFromSelect}
        />
      )}

      {dialog.step === 2 && (
        <StepReview
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
