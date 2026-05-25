/**
 * Presentational shell for the new payment run wizard.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { CreditCard } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { NewPaymentRunConfirmationData } from '../hooks/use-new-payment-run-dialog.js';
import { StepConfirmation } from './step-confirmation.js';
import { StepReviewContainer } from './step-review-container.js';
import { StepSelectContainer } from './step-select-container.js';

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
  setStep: (step: 1 | 2 | 3) => void;
  selectedInvoiceIds: string[];
  setSelectedInvoiceIds: (ids: string[]) => void;
  groupByCurrency: boolean;
  setGroupByCurrency: (v: boolean) => void;
  confirmationData: NewPaymentRunConfirmationData | null;
  handleOpenChange: (open: boolean) => void;
  handleComplete: (data: NewPaymentRunConfirmationData) => void;
  onViewRunFromConfirmation: () => void;
  onClose: () => void;
}

export function NewPaymentRunDialogView({
  open,
  step,
  setStep,
  selectedInvoiceIds,
  setSelectedInvoiceIds,
  groupByCurrency,
  setGroupByCurrency,
  confirmationData,
  handleOpenChange,
  handleComplete,
  onViewRunFromConfirmation,
  onClose,
}: NewPaymentRunDialogViewProps) {
  const t = useTranslations('Payments');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-4" />
            {t('dialog.title')}
          </DialogTitle>
          <StepIndicator currentStep={step} />
        </DialogHeader>

        {step === 1 && (
          <StepSelectContainer
            selectedInvoiceIds={selectedInvoiceIds}
            onSelectionChange={setSelectedInvoiceIds}
            groupByCurrency={groupByCurrency}
            onGroupByCurrencyChange={setGroupByCurrency}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onCancel={() => handleOpenChange(false)}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepReviewContainer
            selectedInvoiceIds={selectedInvoiceIds}
            groupByCurrency={groupByCurrency}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onBack={() => setStep(1)}
            onComplete={handleComplete}
          />
        )}

        {step === 3 && confirmationData && (
          <StepConfirmation
            {...confirmationData}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onViewRun={onViewRunFromConfirmation}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
