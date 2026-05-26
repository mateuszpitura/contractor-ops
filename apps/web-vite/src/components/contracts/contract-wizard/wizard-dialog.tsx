import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@contractor-ops/ui/components/reui/stepper';
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
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
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

type Wizard = ReturnType<typeof useContractWizardDialog>;

export function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <Stepper value={currentStep + 1} className="px-4 py-3">
      <StepperNav className="justify-center">
        {steps.map((label, index) => (
          <StepperItem key={label} step={index + 1} className="not-last:flex-1 items-center">
            <StepperTrigger className="gap-2">
              <StepperIndicator className="size-7 text-xs">{index + 1}</StepperIndicator>
              <StepperTitle className="text-[13px]">{label}</StepperTitle>
            </StepperTrigger>
            {index < steps.length - 1 && <StepperSeparator className="mx-2 h-px w-8" />}
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  );
}

export function WizardStepBody({
  currentStep,
  form,
  contractorId,
  stepDetails,
  preFilledFields,
  stepDocuments,
  handleSkipDocuments,
}: {
  currentStep: number;
  form: Wizard['form'];
  contractorId: string | undefined;
  stepDetails: Wizard['stepDetails'];
  preFilledFields: Set<string>;
  stepDocuments: Wizard['stepDocuments'];
  handleSkipDocuments: () => void;
}) {
  if (currentStep === 0) {
    return <StepDetails form={form} contractorId={contractorId} {...stepDetails} />;
  }
  if (currentStep === 1) {
    return <StepFinancial form={form} preFilledFields={preFilledFields} />;
  }
  return (
    <StepDocuments
      files={stepDocuments.files}
      onDrop={stepDocuments.onDrop}
      removeFile={stepDocuments.removeFile}
      onSkip={handleSkipDocuments}
    />
  );
}

export function WizardFooter({
  currentStep,
  isDirty,
  isPending,
  nextLabels,
  handleBack,
  handleClose,
  handleNext,
  t,
}: {
  currentStep: number;
  isDirty: boolean;
  isPending: boolean;
  nextLabels: string[];
  handleBack: () => void;
  handleClose: () => void;
  handleNext: () => void;
  t: Wizard['t'];
}) {
  return (
    <div className="flex items-center justify-between border-t pt-4 mt-2">
      <div>
        {currentStep > 0 ? (
          <Button type="button" variant="outline" onClick={handleBack}>
            {t('back')}
          </Button>
        ) : (
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {t('discardConfirm.title')}
          </AlertDialogTitle>
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

interface ContractWizardDialogProps {
  open: boolean;
  wizard: Wizard;
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
            <WizardStepBody
              currentStep={currentStep}
              form={form}
              contractorId={contractorId}
              stepDetails={stepDetails}
              preFilledFields={preFilledFields}
              stepDocuments={stepDocuments}
              handleSkipDocuments={handleSkipDocuments}
            />
          </div>

          <WizardFooter
            currentStep={currentStep}
            isDirty={isDirty}
            isPending={isPending}
            nextLabels={nextLabels}
            handleBack={handleBack}
            handleClose={handleClose}
            handleNext={handleNext}
            t={t}
          />
        </DialogContent>
      </Dialog>

      <WizardDiscardDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onDiscard={handleDiscard}
        t={t}
      />
    </>
  );
}
