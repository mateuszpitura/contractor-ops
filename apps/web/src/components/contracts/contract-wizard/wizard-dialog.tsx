'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { Resolver } from 'react-hook-form';
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

import { StepDetails } from './step-details';
import { StepDocuments } from './step-documents';
import { StepFinancial } from './step-financial';

// ---------------------------------------------------------------------------
// Wizard form schema (mirrors contractCreateSchema from validators package)
// Defined locally to avoid cross-package dependency from web -> validators
// ---------------------------------------------------------------------------

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

export type ContractWizardFormValues = z.infer<typeof contractWizardSchema>;

// Per-step validation schemas
const stepSchemas = [
  // Step 1: Contract details
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
  // Step 2: Financial terms
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
  // Step 3: Documents (no required fields -- can skip)
  z.object({}),
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

interface ContractWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorId?: string;
}

/**
 * 3-step contract creation wizard dialog.
 * Uses a single React Hook Form instance across all steps.
 * Validates per-step on "Next" click using step-specific schema picks.
 * When contractorId is provided, pre-fills financial terms from contractor billing profile.
 */
export function ContractWizardDialog({
  open,
  onOpenChange,
  contractorId,
}: ContractWizardDialogProps) {
  const t = useTranslations('Contracts.wizard');
  const queryClient = useQueryClient();

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

  // Fetch contractor data for pre-fill when contractorId is provided
  const { data: contractorData } = useQuery({
    ...trpc.contractor.getById.queryOptions({ id: contractorId ?? '' }),
    enabled: !!contractorId,
  });

  // Pre-fill financial terms from contractor billing profile
  const hasPreFilled = useRef(false);
  useEffect(() => {
    if (contractorData && !hasPreFilled.current) {
      hasPreFilled.current = true;
      const preFilledSet = new Set<string>();

      const contractor = contractorData as Record<string, unknown>;

      if (contractor.currency) {
        form.setValue('currency', contractor.currency as string, {
          shouldDirty: false,
        });
        preFilledSet.add('currency');
      }

      // billingModel and rateValueMinor stored in customFieldsJson
      const customFields = contractor.customFieldsJson as Record<string, unknown> | null;

      if (customFields) {
        if (typeof customFields.billingModel === 'string') {
          form.setValue(
            'billingModel',
            customFields.billingModel as ContractWizardFormValues['billingModel'],
            { shouldDirty: false },
          );
          preFilledSet.add('billingModel');
        }

        if (typeof customFields.rateValueMinor === 'number' && customFields.rateValueMinor > 0) {
          form.setValue('rateValueMinor', customFields.rateValueMinor as number, {
            shouldDirty: false,
          });
          preFilledSet.add('rateValueMinor');
        }
      }

      setPreFilledFields(preFilledSet);
    }
  }, [contractorData, form]);

  const createMutation = useMutation(
    trpc.contract.create.mutationOptions({
      onSuccess: data => {
        const contractId = (data as Record<string, unknown>).id as string;

        // Link uploaded documents to the newly created contract
        if (uploadedDocumentIds.length > 0) {
          void linkDocuments(contractId);
        }

        toast.success(t('success'));
        queryClient.invalidateQueries({ queryKey: ['contract'] });
        handleClose(true);
      },
      onError: () => {
        toast.error(t('error'));
      },
    }),
  );

  const linkToEntityMutation = useMutation(trpc.document.linkToEntity.mutationOptions({}));

  async function linkDocuments(contractId: string) {
    for (const docId of uploadedDocumentIds) {
      try {
        await linkToEntityMutation.mutateAsync({
          documentId: docId,
          entityType: 'CONTRACT',
          entityId: contractId,
        } as Parameters<typeof linkToEntityMutation.mutateAsync>[0]);
      } catch {
        console.error(`Failed to link document ${docId} to contract`);
      }
    }
  }

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
    setUploadedDocumentIds([]);
    setPreFilledFields(new Set());
    hasPreFilled.current = false;
    onOpenChange(false);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    form.reset();
    resetSteps();
    setUploadedDocumentIds([]);
    setPreFilledFields(new Set());
    hasPreFilled.current = false;
    onOpenChange(false);
  };

  const submitForm = () => {
    form.handleSubmit((data: ContractWizardFormValues) => {
      createMutation.mutate({
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      } as Parameters<typeof createMutation.mutate>[0]);
    })();
  };

  const handleNext = async () => {
    const schema = stepSchemas[currentStep];
    if (!schema) return;

    // Validate only the current step's fields
    const stepFields = Object.keys(schema.shape) as Array<keyof ContractWizardFormValues>;

    // For step 3 (documents), no validation needed
    if (stepFields.length > 0) {
      const isValid = await form.trigger(stepFields);
      if (!isValid) return;
    }

    if (currentStep < 2) {
      goNext();
    } else {
      submitForm();
    }
  };

  const handleBack = () => {
    goBack();
  };

  const handleSkipDocuments = () => {
    submitForm();
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

          {/* Step content */}
          <div className="min-h-[320px] px-1">
            {currentStep === 0 && <StepDetails form={form} contractorId={contractorId} />}
            {currentStep === 1 && <StepFinancial form={form} preFilledFields={preFilledFields} />}
            {currentStep === 2 && (
              <StepDocuments
                onDocumentsChange={setUploadedDocumentIds}
                onSkip={handleSkipDocuments}
              />
            )}
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
