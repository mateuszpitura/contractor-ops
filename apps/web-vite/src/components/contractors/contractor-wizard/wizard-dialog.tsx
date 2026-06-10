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
import { DialogFooter } from '@contractor-ops/ui/components/shadcn/dialog';
import { contractorTypeEnum } from '@contractor-ops/validators';
import { Check, Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { z } from 'zod';
import { isValidNip } from '../../../lib/nip-validator.js';
import { WizardDialogShell } from '../../wizard/wizard-dialog-shell.js';
import type { useContractorWizardDialog as UseContractorWizardDialog } from '../hooks/use-contractor-wizard-dialog.js';
import { useContractorWizardDialog } from '../hooks/use-contractor-wizard-dialog.js';
import { StepAssignment } from './step-assignment.js';
import { StepBilling } from './step-billing.js';
import { StepCompany } from './step-company.js';

function preventEnterSubmit(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
    e.preventDefault();
  }
}

const wizardSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required').max(255),
  displayName: z.string().max(255),
  type: contractorTypeEnum,
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

type Wizard = ReturnType<typeof UseContractorWizardDialog>;

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

export function WizardFooter({
  currentStep,
  isDirty,
  isSubmitting,
  nextLabels,
  handleBack,
  handleClose,
  handleNext,
  t,
}: {
  currentStep: number;
  isDirty: boolean;
  isSubmitting: boolean;
  nextLabels: string[];
  handleBack: () => void;
  handleClose: () => void;
  handleNext: () => void;
  t: Wizard['t'];
}) {
  return (
    <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
      <div>
        {currentStep > 0 ? (
          <Button type="button" variant="outline" onClick={handleBack}>
            {t('back')}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={handleClose}>
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
  );
}

export function WizardDiscardDialog({
  open,
  onOpenChange,
  onDiscard,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  t: Wizard['t'];
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('discardConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('discardConfirm.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('discardConfirm.keep')}</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard} variant="destructive">
            {t('discardConfirm.discard')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type WizardDialogViewProps = Wizard;

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
  const handleCancelDirtyClose = useCallback(
    () => setShowDiscardDialog(false),
    [setShowDiscardDialog],
  );

  return (
    <>
      <WizardDialogShell
        open={open}
        onOpenChange={handleDialogOpenChange}
        title={t('title')}
        contentClassName="sm:max-w-[640px]"
        stepper={<StepIndicator steps={stepLabels} currentStep={currentStep} />}
        footer={
          <WizardFooter
            currentStep={currentStep}
            isDirty={isDirty}
            isSubmitting={isSubmitting}
            nextLabels={nextLabels}
            handleBack={handleBack}
            handleClose={handleClose}
            handleNext={handleNext}
            t={t}
          />
        }
        showDirtyClose={false}
        onConfirmDirtyClose={handleDiscard}
        onCancelDirtyClose={handleCancelDirtyClose}>
        <div className="min-h-[320px] px-1" role="presentation" onKeyDown={preventEnterSubmit}>
          {currentStep === 0 && <StepCompany form={form} />}
          {currentStep === 1 && <StepBilling form={form} />}
          {currentStep === 2 && <StepAssignment form={form} />}
        </div>
      </WizardDialogShell>

      <WizardDiscardDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onDiscard={handleDiscard}
        t={t}
      />
    </>
  );
}

export function WizardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dialog = useContractorWizardDialog(open, onOpenChange);
  return <WizardDialogView {...dialog} />;
}
