// ---------------------------------------------------------------------------
// ClassificationWizardShell — multi-step assessment wizard.
// ---------------------------------------------------------------------------
// IMPORTANT: Do NOT import from @contractor-ops/classification/profiles/*/scoring.*
// Scoring is server-only. All outcome computation happens inside
// `trpc.classification.submit` on the server.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import type { UseMutationResult } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocale } from '../../../../i18n/navigation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useClassificationWizardShell } from '../hooks/use-classification-wizard-shell.js';
import { ClassificationAutosaveIndicator } from './classification-autosave-indicator';
import type { AutosaveStatus } from './classification-autosave-indicator.js';
import { ClassificationProgressBar } from './classification-progress-bar';
import type { ClassificationStepIndicatorStep } from './classification-step-indicator';
import { ClassificationStepIndicator } from './classification-step-indicator';
import type { Ir35StepDefinition } from './ir35/ir35-wizard-steps';
import { Ir35StepContent, useIr35Steps } from './ir35/ir35-wizard-steps';
import type { ScheinStepDefinition } from './schein/schein-wizard-steps';
import { ScheinStepContent, useScheinSteps } from './schein/schein-wizard-steps';
import type { RuleSetLocale, WizardAnswerValue } from './wizard-question';

const RATIONALE_DEBOUNCE_MS = 500;
export const CLASSIFICATION_WIZARD_SUPPORTED_COUNTRIES = new Set(['GB', 'DE']);

export type WizardCountryCode = 'GB' | 'DE';

export function ClassificationWizardUnsupportedCountry({ countryCode }: { countryCode: string }) {
  const t = useTranslations('Classification');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('emptyState.notSupported')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t('emptyState.notSupportedBody', { countryCode })}
        </p>
      </CardContent>
    </Card>
  );
}

export interface ClassificationWizardShellViewProps {
  assessmentId: string;
  contractorAssignmentId: string;
  contractorId: string;
  countryCode: WizardCountryCode;
  /** Epoch ms — initial updatedAt from the draft, used for optimistic concurrency. */
  initialUpdatedAt: number;
  /** Pre-loaded draft answers for resume support. */
  initialAnswers?: Record<string, WizardAnswerValue>;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: number | null;
  submitMutation: Pick<UseMutationResult<unknown, unknown, unknown, unknown>, 'isPending'>;
  commitAnswer: (questionId: string, value: WizardAnswerValue) => void;
  submitAssessment: () => void;
}

type WizardStepDefinition = Ir35StepDefinition | ScheinStepDefinition;

export function ClassificationWizardShellView({
  countryCode,
  initialAnswers = {},
  autosaveStatus,
  lastSavedAt,
  submitMutation,
  commitAnswer,
  submitAssessment,
}: ClassificationWizardShellViewProps) {
  const locale = useLocale();
  const ruleSetLocale: RuleSetLocale = locale === 'de' || locale === 'pl' ? locale : 'en';
  const t = useTranslations('Classification');
  const titleId = useId();

  const ir35Steps = useIr35Steps();
  const scheinSteps = useScheinSteps();
  const steps: readonly WizardStepDefinition[] = countryCode === 'GB' ? ir35Steps : scheinSteps;

  const [answers, setAnswers] = useState<Record<string, WizardAnswerValue | undefined>>(() => ({
    ...initialAnswers,
  }));
  const [currentStep, setCurrentStep] = useState(1);

  const rationaleTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      for (const handle of Object.values(rationaleTimersRef.current)) {
        clearTimeout(handle);
      }
    };
  }, []);

  const onAnswerChange = useCallback(
    (questionId: string, value: WizardAnswerValue) => {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
      commitAnswer(questionId, value);
    },
    [commitAnswer],
  );

  const currentStepDef = steps[currentStep - 1];
  const indicatorSteps: readonly ClassificationStepIndicatorStep[] = useMemo(
    () =>
      steps.map(step => ({
        id: step.id,
        label: step.label,
        subtitle: 'subtitle' in step ? step.subtitle : undefined,
      })),
    [steps],
  );

  const currentStepCompletion = useMemo(() => {
    if (!currentStepDef) return 0;
    const required = currentStepDef.questions.filter(q => q.required);
    if (required.length === 0) return 1;
    const answered = required.filter(q => answers[q.id] !== undefined).length;
    return answered / required.length;
  }, [answers, currentStepDef]);

  const canAdvance = currentStepCompletion >= 1;
  const isFinalStep = currentStep === steps.length;

  const handleNext = useCallback(() => {
    if (!canAdvance) return;
    setCurrentStep(step => Math.min(step + 1, steps.length));
  }, [canAdvance, steps.length]);

  const handlePrevious = useCallback(() => {
    setCurrentStep(step => Math.max(step - 1, 1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canAdvance) return;
    submitAssessment();
  }, [canAdvance, submitAssessment]);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 id={titleId} className="text-xl font-semibold tracking-tight">
              {countryCode === 'GB' ? t('ir35.title') : t('schein.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('stepCounter', { current: currentStep, total: steps.length })}
            </p>
          </div>
          <ClassificationAutosaveIndicator status={autosaveStatus} lastSavedAt={lastSavedAt} />
        </div>
        <ClassificationProgressBar
          currentStep={currentStep}
          totalSteps={steps.length}
          currentStepCompletion={currentStepCompletion}
          currentStepLabel={currentStepDef?.label ?? ''}
        />
        <ClassificationStepIndicator steps={indicatorSteps} currentStep={currentStep} />
      </header>

      {currentStepDef ? (
        <Card>
          <CardHeader>
            <CardTitle>{currentStepDef.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {countryCode === 'GB' ? (
              <Ir35StepContent
                step={currentStepDef as Ir35StepDefinition}
                locale={ruleSetLocale}
                answers={answers}
                onAnswerChange={onAnswerChange}
                disabled={submitMutation.isPending}
              />
            ) : (
              <ScheinStepContent
                step={currentStepDef as ScheinStepDefinition}
                locale={ruleSetLocale}
                answers={answers}
                onAnswerChange={onAnswerChange}
                disabled={submitMutation.isPending}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/contractors" />}>
            {t('cancelDraft')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 1 || submitMutation.isPending}>
            {t('previous')}
          </Button>
          {isFinalStep ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canAdvance || submitMutation.isPending}>
              {t('submitAssessment')}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canAdvance || submitMutation.isPending}>
              {t('next')}
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
}

// Public helpers for tests — expose the debounce constant so unit tests
// can assert the 500ms rationale window without re-declaring it.
export const CLASSIFICATION_RATIONALE_DEBOUNCE_MS = RATIONALE_DEBOUNCE_MS;

export function ClassificationWizardShellContainer(
  props: Pick<
    ClassificationWizardShellViewProps,
    | 'assessmentId'
    | 'contractorAssignmentId'
    | 'contractorId'
    | 'countryCode'
    | 'initialUpdatedAt'
    | 'initialAnswers'
  >,
) {
  const shell = useClassificationWizardShell(
    props.assessmentId,
    props.contractorId,
    props.contractorAssignmentId,
    props.initialUpdatedAt,
  );

  if (!CLASSIFICATION_WIZARD_SUPPORTED_COUNTRIES.has(props.countryCode)) {
    return <ClassificationWizardUnsupportedCountry countryCode={props.countryCode} />;
  }

  return <ClassificationWizardShellView {...props} {...shell} />;
}

/** @deprecated Use ClassificationWizardShell */
export { ClassificationWizardShellContainer as ClassificationWizardShell };
