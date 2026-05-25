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
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react';
import { z } from 'zod';

import type { useContractWizardDialog } from '../hooks/use-contract-wizard-dialog.js';
import { StepDetails } from './step-details.js';
import { StepDocuments } from './step-documents.js';
import { StepFinancial } from './step-financial.js';

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

interface ContractWizardDialogProps {
  open: boolean;
  wizard: ReturnType<typeof useContractWizardDialog>;
}

export function ContractWizardDialog({ open, wizard }: ContractWizardDialogProps) {
  const {
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
  } = wizard;

  return (
    <>
      {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
      <Dialog open={open} onOpenChange={o => !o && handleClose()}>
        <DialogContent className="sm:max-w-[640px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {t('title')}
            </DialogTitle>
          </DialogHeader>

          <StepIndicator steps={stepLabels} currentStep={currentStep} />

          <div className="min-h-[320px] px-1">
            {currentStep === 0 && (
              <StepDetails form={form} contractorId={contractorId} {...stepDetails} />
            )}
            {currentStep === 1 && <StepFinancial form={form} preFilledFields={preFilledFields} />}
            {currentStep === 2 && (
              <StepDocuments
                files={stepDocuments.files}
                onDrop={stepDocuments.onDrop}
                removeFile={stepDocuments.removeFile}
                onSkip={handleSkipDocuments}
              />
            )}
          </div>

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
            <Button type="button" onClick={handleNext} disabled={isPending}>
              {isPending ? (
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

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t('discardConfirm.title')}
            </AlertDialogTitle>
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
