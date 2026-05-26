// ---------------------------------------------------------------------------
// ScheinWizardSteps — DRV 4-step composition.
// ---------------------------------------------------------------------------
// Per UI-SPEC §Step labels + §Copywriting Contract (weight subtitle). Step 4
// (economic-dep) renders the EconomicDependencyInput for DRV-ECO-01 via the
// default dispatcher's 'billing-ratio' branch — no override needed here.

import type { RuleSetQuestion, ScheinCategory } from '@contractor-ops/classification';
import { CATEGORY_WEIGHTS, SCHEIN_QUESTIONS } from '@contractor-ops/classification';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../../../i18n/useTranslations.js';

import type { RuleSetLocale, WizardAnswerValue } from '../wizard-question';
import { WizardQuestion } from '../wizard-question';

/** DRV step order — MUST match ScheinCategory type order. */
export const SCHEIN_STEP_ORDER = [
  'integration',
  'entrepreneurial',
  'personal-dep',
  'economic-dep',
] as const satisfies readonly ScheinCategory[];

export type ScheinStepKey = (typeof SCHEIN_STEP_ORDER)[number];

export interface ScheinStepDefinition {
  id: ScheinStepKey;
  label: string;
  subtitle: string;
  questions: readonly RuleSetQuestion[];
}

export function useScheinSteps(): readonly ScheinStepDefinition[] {
  const t = useTranslations('Classification.schein.step');
  const tWeight = useTranslations('Classification.schein');

  return useMemo(
    () =>
      SCHEIN_STEP_ORDER.map(category => ({
        id: category,
        label: t(categoryToLabelKey(category)),
        subtitle: tWeight('weightLabel', { weight: CATEGORY_WEIGHTS[category] }),
        questions: SCHEIN_QUESTIONS.filter(q => q.category === category),
      })),
    [t, tWeight],
  );
}

function categoryToLabelKey(
  category: ScheinCategory,
): 'integration' | 'entrepreneurial' | 'personalDep' | 'economicDep' {
  switch (category) {
    case 'integration':
      return 'integration';
    case 'entrepreneurial':
      return 'entrepreneurial';
    case 'personal-dep':
      return 'personalDep';
    case 'economic-dep':
      return 'economicDep';
  }
}

export interface ScheinStepContentProps {
  step: ScheinStepDefinition;
  locale: RuleSetLocale;
  answers: Record<string, WizardAnswerValue | undefined>;
  onAnswerChange: (questionId: string, value: WizardAnswerValue) => void;
  disabled?: boolean;
}

export function ScheinStepContent({
  step,
  locale,
  answers,
  onAnswerChange,
  disabled,
}: ScheinStepContentProps) {
  return (
    <div className="flex flex-col gap-4">
      {step.questions.map(question => (
        <ScheinQuestionItem
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

function ScheinQuestionItem({
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
