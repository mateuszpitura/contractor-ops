import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useWizardSteps } from '../../../hooks/use-wizard-steps.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractWizardFormValues } from '../contract-wizard/wizard-dialog.js';
import { useContractWizardCreate, useContractWizardPrefill } from './use-contract-wizard.js';
import { useContractWizardStepDetails } from './use-contract-wizard-step-details.js';
import { useContractWizardStepDocuments } from './use-contract-wizard-step-documents.js';

const contractWizardSchema = z.object({
  contractorId: z.string().min(1, 'Contractor is required'),
  title: z.string().min(1, 'Contract title is required').max(255),
  type: z.enum(['B2B_MASTER_SERVICE', 'STATEMENT_OF_WORK', 'NDA', 'IP_ASSIGNMENT', 'DPA', 'OTHER']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  noticePeriodDays: z.number().int().positive().optional(),
  autoRenewal: z.boolean().default(false),
  currency: z.string().length(3),
  billingModel: z.enum([
    'MONTHLY_RETAINER',
    'HOURLY',
    'DAILY',
    'MILESTONE',
    'DELIVERABLE_BASED',
    'MIXED',
  ]),
  rateType: z.enum(['MONTHLY_FIXED', 'PER_HOUR', 'PER_DAY', 'PER_MILESTONE', 'PER_DELIVERABLE']),
  rateValueMinor: z.number().int().nonnegative().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  invoiceCycle: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_DELIVERABLE', 'AD_HOC']).optional(),
});

const stepSchemas = [
  z.object({
    contractorId: z.string().min(1),
    title: z.string().min(1),
    type: z.enum([
      'B2B_MASTER_SERVICE',
      'STATEMENT_OF_WORK',
      'NDA',
      'IP_ASSIGNMENT',
      'DPA',
      'OTHER',
    ]),
    startDate: z.string().min(1),
  }),
  z.object({
    currency: z.string().length(3),
    billingModel: z.enum([
      'MONTHLY_RETAINER',
      'HOURLY',
      'DAILY',
      'MILESTONE',
      'DELIVERABLE_BASED',
      'MIXED',
    ]),
    rateType: z.enum(['MONTHLY_FIXED', 'PER_HOUR', 'PER_DAY', 'PER_MILESTONE', 'PER_DELIVERABLE']),
  }),
  z.object({}),
] as const;

interface UseContractWizardDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorId?: string;
}

export function useContractWizardDialog({
  onOpenChange,
  contractorId,
}: UseContractWizardDialogOptions) {
  const t = useTranslations('Contracts.wizard');
  const { currentStep, goNext, goBack, reset: resetSteps } = useWizardSteps(3);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [uploadedDocumentIds, setUploadedDocumentIds] = useState<string[]>([]);
  const [preFilledFields, setPreFilledFields] = useState<Set<string>>(new Set());

  const form = useForm<ContractWizardFormValues>({
    resolver: zodResolver(contractWizardSchema) as unknown as Resolver<ContractWizardFormValues>,
    defaultValues: {
      contractorId: contractorId ?? '',
      title: '',
      type: undefined,
      startDate: '',
      endDate: undefined,
      noticePeriodDays: undefined,
      autoRenewal: false,
      currency: 'PLN',
      billingModel: undefined,
      rateType: undefined,
      rateValueMinor: 0,
      paymentTermsDays: undefined,
      invoiceCycle: undefined,
    },
  });

  const handleCloseSuccess = useCallback(() => {
    form.reset();
    resetSteps();
    setUploadedDocumentIds([]);
    setPreFilledFields(new Set());
    onOpenChange(false);
  }, [form, onOpenChange, resetSteps]);

  const { resetPrefill } = useContractWizardPrefill(form, contractorId, setPreFilledFields);
  const { isPending, submitCreate } = useContractWizardCreate(
    uploadedDocumentIds,
    handleCloseSuccess,
  );

  const stepDetails = useContractWizardStepDetails(form, contractorId);
  const stepDocuments = useContractWizardStepDocuments(setUploadedDocumentIds);

  const stepLabels = [t('step1'), t('step2'), t('step3')];
  const nextLabels = [t('next1'), t('next2'), t('submit')];
  const isDirty = form.formState.isDirty;

  const resetWizard = useCallback(() => {
    form.reset();
    resetSteps();
    setUploadedDocumentIds([]);
    setPreFilledFields(new Set());
    stepDocuments.resetFiles();
    resetPrefill();
  }, [form, resetPrefill, resetSteps, stepDocuments]);

  const handleClose = useCallback(
    (force = false) => {
      if (!force && isDirty) {
        setShowDiscardDialog(true);
        return;
      }
      resetWizard();
      onOpenChange(false);
    },
    [isDirty, onOpenChange, resetWizard],
  );

  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    resetWizard();
    onOpenChange(false);
  }, [onOpenChange, resetWizard]);

  const submitForm = useCallback(() => {
    void form.handleSubmit((data: ContractWizardFormValues) => {
      submitCreate({
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      } as Parameters<typeof submitCreate>[0]);
    })();
  }, [form, submitCreate]);

  const handleNext = useCallback(async () => {
    const schema = stepSchemas[currentStep];
    if (!schema) return;

    const stepFields = Object.keys(schema.shape) as Array<keyof ContractWizardFormValues>;

    if (stepFields.length > 0) {
      const isValid = await form.trigger(stepFields);
      if (!isValid) return;
    }

    if (currentStep < 2) {
      goNext();
    } else {
      submitForm();
    }
  }, [currentStep, form, goNext, submitForm]);

  const handleBack = useCallback(() => {
    goBack();
  }, [goBack]);

  const handleSkipDocuments = useCallback(() => {
    submitForm();
  }, [submitForm]);

  return {
    t,
    form,
    contractorId,
    currentStep,
    showDiscardDialog,
    setShowDiscardDialog,
    preFilledFields,
    stepDetails,
    stepDocuments,
    stepLabels,
    nextLabels,
    isPending,
    isDirty,
    handleClose,
    handleDiscard,
    handleNext,
    handleBack,
    handleSkipDocuments,
  } as const;
}
