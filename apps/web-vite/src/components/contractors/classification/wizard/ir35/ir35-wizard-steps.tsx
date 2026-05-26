// ---------------------------------------------------------------------------
// Ir35WizardSteps — IR35 5-step composition.
// ---------------------------------------------------------------------------
// Per UI-SPEC §Step labels. Consumes IR35_QUESTIONS from the Plan 02 rule
// set and groups them by `area`. Renders only the CURRENT step's questions
// (the shell controls `currentStep`).

import type { Ir35Area, RuleSetQuestion } from '@contractor-ops/classification';
import { IR35_QUESTIONS } from '@contractor-ops/classification';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../../../i18n/useTranslations.js';

import type { RuleSetLocale, WizardAnswerValue } from '../wizard-question';
import { WizardQuestion } from '../wizard-question';

/** IR35 step order — MUST match Ir35Area type order. */
export const IR35_STEP_ORDER = [
  'substitution',
  'control',
  'financial-risk',
  'part-and-parcel',
  'moo',
] as const satisfies readonly Ir35Area[];

export type Ir35StepKey = (typeof IR35_STEP_ORDER)[number];

export interface Ir35StepDefinition {
  id: Ir35StepKey;
  label: string;
  questions: readonly RuleSetQuestion[];
}

export function useIr35Steps(): readonly Ir35StepDefinition[] {
  const t = useTranslations('Classification.ir35.step');

  return useMemo(
    () =>
      IR35_STEP_ORDER.map(area => ({
        id: area,
        label: t(areaToLabelKey(area)),
        questions: IR35_QUESTIONS.filter(q => q.area === area),
      })),
    [t],
  );
}

function areaToLabelKey(
  area: Ir35Area,
): 'substitution' | 'control' | 'financialRisk' | 'partAndParcel' | 'moo' {
  switch (area) {
    case 'substitution':
      return 'substitution';
    case 'control':
      return 'control';
    case 'financial-risk':
      return 'financialRisk';
    case 'part-and-parcel':
      return 'partAndParcel';
    case 'moo':
      return 'moo';
  }
}

export interface Ir35StepContentProps {
  step: Ir35StepDefinition;
  locale: RuleSetLocale;
  answers: Record<string, WizardAnswerValue | undefined>;
  onAnswerChange: (questionId: string, value: WizardAnswerValue) => void;
  disabled?: boolean;
}

export function Ir35StepContent({
  step,
  locale,
  answers,
  onAnswerChange,
  disabled,
}: Ir35StepContentProps) {
  return (
    <div className="flex flex-col gap-4">
      {step.questions.map(question => (
        <Ir35QuestionItem
          key={question.id}
          question={question}
          locale={locale}
          value={answers[question.id]}
          onAnswerChange={onAnswerChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function Ir35QuestionItem({
  question,
  locale,
  value,
  onAnswerChange,
  disabled,
}: {
  question: RuleSetQuestion;
  locale: RuleSetLocale;
  value: WizardAnswerValue | undefined;
  onAnswerChange: (questionId: string, value: WizardAnswerValue) => void;
  disabled?: boolean;
}) {
  const handleChange = useCallback(
    (next: WizardAnswerValue) => onAnswerChange(question.id, next),
    [onAnswerChange, question.id],
  );

  return (
    <WizardQuestion
      question={question}
      locale={locale}
      value={value}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}
