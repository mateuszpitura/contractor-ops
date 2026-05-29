import { Check, Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { z } from 'zod';

import { isValidNip } from '../../../lib/nip-validator.js';
import type { useContractorWizardDialog } from '../hooks/use-contractor-wizard-dialog.js';
import { StepAssignmentContainer } from './step-assignment-container.js';
import { StepBilling } from './step-billing.js';
import { StepCompanyContainer } from './step-company-container.js';

// ---------------------------------------------------------------------------
// Wizard form schema (mirrors contractorCreateSchema from validators package)

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';

function preventEnterSubmit(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
    e.preventDefault();
  }
}

const wizardSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required').max(255),
  displayName: z.string().max(255),
  type: z.enum(['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER']),
  taxId: z
    .string()
    .min(1, 'NIP is required')
    // biome-ignore lint/plugin/no-untranslated-zod-message: key resolved client-side via zod-issues-to-keys
    .refine(v => isValidNip(v), { message: 'Common.validationInvalidNip' }),
  vatId: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  registrationNumber: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  countryCode: z.string().length(2),
  currency: z.string().length(3),
  addressLine1: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  addressLine2: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  city: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  postalCode: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  billingModel: z.string().min(1, 'Billing model is required'),
  rateValueMinor: z.number().int().positive('Rate must be positive'),
  bankAccount: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional()),
  paymentTermsDays: z.preprocess(
    v =>
      v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v,
    z.number().int().positive().optional(),
  ),
  ownerUserId: z.string().min(1, 'Owner is required'),
  primaryTeamId: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().min(1).optional()),
  primaryProjectId: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().min(1).optional()),
  defaultCostCenterId: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().min(1).optional()),
});

export type WizardFormValues = z.input<typeof wizardSchema>;

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3">
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={label} className="flex items-center">
            {index > 0 && (
              <div
                className={`mx-2 h-px w-8 ${index <= currentStep ? 'bg-primary' : 'bg-border'}`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-2 border-primary text-primary'
                      : 'border border-border text-muted-foreground'
                }`}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={`text-[13px] ${
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard dialog (presentational)
// ---------------------------------------------------------------------------

export type WizardDialogViewProps = ReturnType<typeof useContractorWizardDialog>;

/**
 * 3-step add contractor wizard dialog.
 * Uses a single React Hook Form instance across all steps.
 * Validates per-step on "Next" click using step-specific schema picks.
 */
export function WizardDialogView({
  open,
  t,
  form,
  currentStep,
  stepLabels,
  nextLabels,
  showDiscardDialog,
  setShowDiscardDialog,
  isDirty,
  isSubmitting,
  handleClose,
  handleDiscard,
  handleNext,
  handleBack,
  handleDialogOpenChange,
}: WizardDialogViewProps) {
  const handleCloseClick = useCallback(() => handleClose(), [handleClose]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[640px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <DialogSection>
            <StepIndicator steps={stepLabels} currentStep={currentStep} />
          </DialogSection>

          <DialogBody
            className="min-h-[320px] px-1"
            role="presentation"
            onKeyDown={preventEnterSubmit}>
            {currentStep === 0 && <StepCompanyContainer form={form} />}
            {currentStep === 1 && <StepBilling form={form} />}
            {currentStep === 2 && <StepAssignmentContainer form={form} />}
          </DialogBody>

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <div>
              {currentStep > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t('back')}
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={handleCloseClick}>
                  {isDirty ? t('discardChanges') : t('close')}
                </Button>
              )}
            </div>
            <Button type="button" onClick={handleNext} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('submit')}
                </>
              ) : (
                nextLabels[currentStep]
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Discard confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('discardConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('discardConfirm.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('discardConfirm.keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} variant="destructive">
              {t('discardConfirm.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
