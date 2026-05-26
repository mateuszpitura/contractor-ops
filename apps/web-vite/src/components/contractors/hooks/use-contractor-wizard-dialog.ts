import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useRef, useState } from 'react';
import type { Resolver, UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useWizardSteps } from '../../../hooks/use-wizard-steps.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { isValidNip } from '../../../lib/nip-validator.js';
import type { WizardFormValues } from '../contractor-wizard/wizard-dialog.js';
import { useContractorWizardCreate } from './use-contractor-wizard.js';

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

const stepSchemas = [
  z.object({
    legalName: z.string().min(1),
    type: z.enum(['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER']),
    taxId: z
      .string()
      .min(1)
      .refine(v => isValidNip(v), { message: 'Invalid NIP number' }),
    email: z.email(),
  }),
  z.object({
    billingModel: z.string().min(1),
    currency: z.string().length(3),
    rateValueMinor: z.number().positive(),
  }),
  z.object({
    ownerUserId: z.string().min(1),
  }),
] as const;

export function useContractorWizardDialog(open: boolean, onOpenChange: (open: boolean) => void) {
  const t = useTranslations('ContractorWizard');
  const { currentStep, goNext, goBack, reset: resetSteps } = useWizardSteps(3);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const handleCloseRef = useRef<(force?: boolean) => void>(() => undefined);
  const createMutation = useContractorWizardCreate(() => handleCloseRef.current(true));

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema) as Resolver<WizardFormValues>,
    defaultValues: {
      legalName: '',
      displayName: '',
      type: undefined,
      taxId: '',
      vatId: '',
      registrationNumber: '',
      email: '',
      phone: '',
      countryCode: 'PL',
      currency: 'PLN',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
      billingModel: '',
      rateValueMinor: 0,
      bankAccount: '',
      paymentTermsDays: '',
      ownerUserId: '',
      primaryTeamId: '',
      primaryProjectId: '',
      defaultCostCenterId: '',
    },
  });

  const stepLabels = [t('step1'), t('step2'), t('step3')];
  const nextLabels = [t('next1'), t('next2'), t('submit')];
  const isDirty = form.formState.isDirty;

  const handleClose = useCallback(
    (force = false) => {
      if (!force && isDirty) {
        setShowDiscardDialog(true);
        return;
      }
      form.reset();
      resetSteps();
      onOpenChange(false);
    },
    [isDirty, form, resetSteps, onOpenChange],
  );
  handleCloseRef.current = handleClose;

  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    form.reset();
    resetSteps();
    onOpenChange(false);
  }, [form, resetSteps, onOpenChange]);

  const handleNext = useCallback(async () => {
    const schema = stepSchemas[currentStep];
    if (!schema) return;

    const stepFields = Object.keys(schema.shape) as Array<keyof WizardFormValues>;
    const isValid = await form.trigger(stepFields);
    if (!isValid) return;

    if (currentStep < 2) {
      if (currentStep === 0 && !form.getValues('displayName')) {
        form.setValue('displayName', form.getValues('legalName'));
      }
      goNext();
    } else {
      const data = form.getValues();
      createMutation.mutate({
        ...data,
        displayName: data.displayName || data.legalName,
      });
    }
  }, [currentStep, form, goNext, createMutation]);

  const handleBack = useCallback(() => {
    goBack();
  }, [goBack]);

  const handleDialogOpenChange = useCallback(
    (o: boolean) => {
      if (!o) handleClose();
    },
    [handleClose],
  );

  return {
    open,
    t,
    form: form as UseFormReturn<WizardFormValues>,
    currentStep,
    stepLabels,
    nextLabels,
    showDiscardDialog,
    setShowDiscardDialog,
    isDirty,
    isSubmitting: createMutation.isPending,
    handleClose,
    handleDiscard,
    handleNext,
    handleBack,
    handleDialogOpenChange,
  } as const;
}
