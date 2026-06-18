/**
 * Portal W-form wizard container. Owns the layout, the reui Stepper progress, the
 * AnimateIn entrance, and the loading / empty / error states. All data access
 * lives in `use-tax-form-wizard`; this file dispatches the active step to a
 * presentational component and never touches tRPC.
 */

import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
} from '@contractor-ops/ui/components/reui/stepper';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { AnimateIn } from '../../shared/animate-in.js';
import type { WizardStep } from './hooks/use-tax-form-wizard.js';
import { useTaxFormWizard } from './hooks/use-tax-form-wizard.js';
import { StepAttest } from './step-attest.js';
import { StepDetermination } from './step-determination.js';
import { StepReceipt } from './step-receipt.js';
import { StepW8Ben } from './step-w8ben.js';
import { StepW8BenE } from './step-w8ben-e.js';
import { StepW9 } from './step-w9.js';

const STEP_LABEL_KEYS: Record<WizardStep, string> = {
  determination: 'step.determination',
  form: 'step.form',
  attest: 'step.attest',
  receipt: 'step.receipt',
};

const STEP_ORDER: WizardStep[] = ['determination', 'form', 'attest', 'receipt'];

function WizardSkeleton() {
  return (
    <Card className="bg-card" aria-busy aria-live="polite">
      <CardHeader className="space-y-4 border-b">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={`tax-form-step-skel-${i}`} className="flex flex-1 items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="hidden h-4 w-20 sm:block" />
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}

export function TaxFormWizard() {
  const t = useTranslations('TaxFormWizard');
  const tAria = useTranslations('Common.aria');
  const wizard = useTaxFormWizard();

  if (wizard.isLoading) {
    return <WizardSkeleton />;
  }

  if (wizard.isLoadError || !wizard.determination) {
    return (
      <Card className="bg-card">
        <CardContent className="space-y-4 py-12 text-center">
          <h2 className="font-display text-lg font-semibold">{t('error.loadHeading')}</h2>
          <p className="text-sm text-muted-foreground">{t('error.loadBody')}</p>
          <Button type="button" onClick={wizard.reloadDetermination}>
            {t('error.reload')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const steps = STEP_ORDER.map((stepKey, index) => ({
    step: index + 1,
    label: t(STEP_LABEL_KEYS[stepKey]),
  }));
  const currentStepNumber = STEP_ORDER.indexOf(wizard.step) + 1;
  const progress = (currentStepNumber / STEP_ORDER.length) * 100;

  return (
    <div className="space-y-section-gap">
      <AnimateIn delay={0}>
        <div className="space-y-1 text-start">
          <h1 className="font-display text-2xl font-semibold leading-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </AnimateIn>

      <AnimateIn delay={1}>
        <div className="space-y-3">
          <Stepper
            value={currentStepNumber}
            aria-label={tAria('wizardProgress')}
            aria-readonly="true">
            <StepperNav className="gap-4">
              {steps.map(({ step, label }, index) => (
                <StepperItem key={step} step={step} className="items-center">
                  <div
                    className="flex items-center gap-1.5"
                    aria-current={step === currentStepNumber ? 'step' : undefined}>
                    <StepperIndicator className="size-6 text-xs">{step}</StepperIndicator>
                    <StepperTitle className="hidden text-sm sm:inline">{label}</StepperTitle>
                  </div>
                  {index < steps.length - 1 && (
                    <StepperSeparator className="mx-2 hidden h-px flex-1 sm:block" />
                  )}
                </StepperItem>
              ))}
            </StepperNav>
          </Stepper>
          <Progress value={progress} />
        </div>
      </AnimateIn>

      <AnimateIn delay={2}>
        {wizard.step === 'determination' && (
          <StepDetermination
            fieldId={wizard.fieldId}
            routedFormType={wizard.determination.formType}
            activeFormType={wizard.activeFormType}
            onFormTypeChange={wizard.setActiveFormType}
            onContinue={wizard.goNext}
          />
        )}

        {wizard.step === 'form' && wizard.activeFormType === 'W9' && (
          <StepW9
            fieldId={wizard.fieldId}
            register={wizard.register}
            control={wizard.control}
            setValue={wizard.setValue}
            errors={wizard.errors}
            onContinue={wizard.goNext}
            onBack={wizard.goBack}
          />
        )}

        {wizard.step === 'form' && wizard.activeFormType === 'W8BEN' && (
          <StepW8Ben
            fieldId={wizard.fieldId}
            register={wizard.register}
            control={wizard.control}
            setValue={wizard.setValue}
            errors={wizard.errors}
            treatyClaim={wizard.determination.treatyClaim}
            onContinue={wizard.goNext}
            onBack={wizard.goBack}
          />
        )}

        {wizard.step === 'form' && wizard.activeFormType === 'W8BENE' && (
          <StepW8BenE
            fieldId={wizard.fieldId}
            register={wizard.register}
            control={wizard.control}
            setValue={wizard.setValue}
            errors={wizard.errors}
            treatyClaim={wizard.determination.treatyClaim}
            onContinue={wizard.goNext}
            onBack={wizard.goBack}
          />
        )}

        {wizard.step === 'attest' && (
          <StepAttest
            fieldId={wizard.fieldId}
            formType={wizard.activeFormType}
            legalName={wizard.determination.legalName ?? ''}
            register={wizard.register}
            control={wizard.control}
            setValue={wizard.setValue}
            errors={wizard.errors}
            onSubmit={wizard.onSubmit}
            isSubmitting={wizard.isSubmitting}
            submitError={wizard.submitError}
            onBack={wizard.goBack}
          />
        )}

        {wizard.step === 'receipt' && wizard.receipt && (
          <StepReceipt formType={wizard.receipt.formType} signedAt={wizard.receipt.signedAt} />
        )}
      </AnimateIn>
    </div>
  );
}
