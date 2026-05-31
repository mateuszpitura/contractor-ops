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
  DialogSection,
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
