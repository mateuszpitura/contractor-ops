'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWizardSteps } from '@/hooks/use-wizard-steps';
import { trpc } from '@/trpc/init';
import { StepAssignment } from './step-assignment';
import { StepBilling } from './step-billing';
import { StepCompany } from './step-company';

// ---------------------------------------------------------------------------
// Wizard form schema (mirrors contractorCreateSchema from validators package)
// ---------------------------------------------------------------------------

import { isValidNip } from '@/lib/nip-validator';

const wizardSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required').max(255),
  displayName: z.string().max(255),
  type: z.enum(['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER']),
  taxId: z
    .string()
    .min(1, 'NIP is required')
    .refine(v => isValidNip(v), { message: 'Invalid NIP number' }),
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

export type WizardFormValues = z.infer<typeof wizardSchema>;

// Per-step validation schemas
const stepSchemas = [
  // Step 1: Company details (displayName auto-syncs from legalName)
  z.object({
    legalName: z.string().min(1),
    type: z.enum(['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER']),
    taxId: z
      .string()
      .min(1)
      .refine(v => isValidNip(v), { message: 'Invalid NIP number' }),
    email: z.string().email(),
  }),
  // Step 2: Billing
  z.object({
    billingModel: z.string().min(1),
    currency: z.string().length(3),
    rateValueMinor: z.number().positive(),
  }),
  // Step 3: Assignment
  z.object({
    ownerUserId: z.string().min(1),
  }),
] as const;

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
// Wizard dialog
// ---------------------------------------------------------------------------

interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 3-step add contractor wizard dialog.
 * Uses a single React Hook Form instance across all steps.
 * Validates per-step on "Next" click using step-specific schema picks.
 */
export function WizardDialog({ open, onOpenChange }: WizardDialogProps) {
  const t = useTranslations('ContractorWizard');
  const queryClient = useQueryClient();

  const { currentStep, goNext, goBack, reset: resetSteps } = useWizardSteps(3);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      legalName: '',
      displayName: '',
      type: undefined,
      taxId: '',
      vatId: undefined,
      registrationNumber: undefined,
      email: '',
      phone: undefined,
      countryCode: 'PL',
      currency: 'PLN',
      addressLine1: undefined,
      addressLine2: undefined,
      city: undefined,
      postalCode: undefined,
      billingModel: '',
      rateValueMinor: 0,
      bankAccount: undefined,
      paymentTermsDays: undefined,
      ownerUserId: '',
      primaryTeamId: undefined,
      primaryProjectId: undefined,
      defaultCostCenterId: undefined,
    },
  });

  const createMutation = useMutation(
    trpc.contractor.create.mutationOptions({
      onSuccess: () => {
        toast.success(t('success'));
        queryClient.invalidateQueries({ queryKey: ['contractor'] });
        handleClose(true);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || t('error'));
      },
    }),
  );

  const stepLabels = [t('step1'), t('step2'), t('step3')];
  const nextLabels = [t('next1'), t('next2'), t('submit')];

  const isDirty = form.formState.isDirty;

  const handleClose = (force = false) => {
    if (!force && isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    form.reset();
    resetSteps();
    onOpenChange(false);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    form.reset();
    resetSteps();
    onOpenChange(false);
  };

  const handleNext = async () => {
    const schema = stepSchemas[currentStep];
    if (!schema) return;

    // Validate only the current step's fields
    const stepFields = Object.keys(schema.shape) as Array<keyof WizardFormValues>;
    const isValid = await form.trigger(stepFields);

    if (!isValid) return;

    if (currentStep < 2) {
      // Auto-sync displayName from legalName if not set (no dedicated UI field)
      if (currentStep === 0 && !form.getValues('displayName')) {
        form.setValue('displayName', form.getValues('legalName'));
      }
      goNext();
    } else {
      // Final step — all steps validated, submit directly
      const data = form.getValues();
      createMutation.mutate({
        ...data,
        displayName: data.displayName || data.legalName,
      });
    }
  };

  const handleBack = () => {
    goBack();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && handleClose()}>
        <DialogContent className="sm:max-w-[640px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <StepIndicator steps={stepLabels} currentStep={currentStep} />

          {/* Step content — prevent Enter from advancing steps */}
          <div
            className="min-h-[320px] px-1"
            role="presentation"
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                e.preventDefault();
              }
            }}>
            {currentStep === 0 && <StepCompany form={form} />}
            {currentStep === 1 && <StepBilling form={form} />}
            {currentStep === 2 && <StepAssignment form={form} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-4 mt-2">
            <div>
              {currentStep > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  {t('back')}
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => handleClose()}>
                  {isDirty ? t('discardChanges') : t('close')}
                </Button>
              )}
            </div>
            <Button type="button" onClick={handleNext} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('submit')}
                </>
              ) : (
                nextLabels[currentStep]
              )}
            </Button>
          </div>
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
