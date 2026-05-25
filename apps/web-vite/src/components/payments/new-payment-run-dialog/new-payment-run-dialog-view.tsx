/**
 * Presentational shell for the new payment run wizard.
 *
 * The container picks the active step content; this shell renders the
 * dialog frame + step indicator and yields the body as `children`.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { CreditCard } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

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
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-4" />
            {t('dialog.title')}
          </DialogTitle>
          <StepIndicator currentStep={step} />
        </DialogHeader>

        {children}
      </DialogContent>
    </Dialog>
  );
}
