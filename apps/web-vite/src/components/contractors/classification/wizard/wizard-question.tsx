// ---------------------------------------------------------------------------
// WizardQuestion — generic question card + answer-input dispatcher.
// ---------------------------------------------------------------------------
// IMPORTANT: Do NOT import from @contractor-ops/classification/profiles/*/scoring.*
// Scoring is server-only.
//
// Reads a RuleSetQuestion + locale, renders the localised prompt, an optional
// help-text Collapsible, a legal-reference Collapsible (case-law for IR35 or
// DRV reference for DRV), and dispatches to the correct answer component by
// `question.answerType`.

import type { RuleSetQuestion } from '@contractor-ops/classification';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { ChevronRight } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { cn } from '../../../../lib/utils.js';
import type { LikertValue } from './answers/likert-answer';
import { LikertAnswer } from './answers/likert-answer';
import type { Score03Value } from './answers/score-03-answer';
import { Score03Answer } from './answers/score-03-answer';
import type { YesNoValue } from './answers/yes-no-answer';
import { YesNoAnswer } from './answers/yes-no-answer';
import { LegalReferenceCollapsible } from './legal-reference-collapsible';
import { EconomicDependencyInput } from './schein/economic-dependency-input';

/**
 * Narrowed locale — only the 3 authored rule-set translations.
 * `ar` falls back to `en` so the wizard still functions for Arabic-locale users.
 */
export type RuleSetLocale = 'en' | 'pl' | 'de';

/**
 * Discriminated answer payload wired through the wizard form state.
 * Also re-used when rendering outcome breakdowns.
 */
export type WizardAnswerValue =
  | { type: 'yes-no'; value: YesNoValue }
  | { type: 'likert-5'; value: LikertValue }
  | { type: 'score-0-3'; value: Score03Value }
  | { type: 'billing-ratio'; value: number };

export interface WizardQuestionProps {
  question: RuleSetQuestion;
  /** Non-Arabic locale token driving prompt/help-text selection. */
  locale: RuleSetLocale;
  value?: WizardAnswerValue;
  onChange: (value: WizardAnswerValue) => void;
  disabled?: boolean;
}

export function WizardQuestion({
  question,
  locale,
  value,
  onChange,
  disabled,
}: WizardQuestionProps) {
  const t = useTranslations('Classification.helpText');
  const [helpOpen, setHelpOpen] = useState(false);
  const promptId = useId();

  const prompt = question.prompt[locale];
  const help = question.helpText[locale];
  const citation = question.caseLawCitation ?? question.drvReference;
  const legalKind: 'case-law' | 'drv' = question.caseLawCitation == null ? 'drv' : 'case-law';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-1 p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <p id={promptId} className="text-sm font-medium text-foreground">
          {prompt}
          {question.required ? (
            <span aria-hidden="true" className="ms-1 text-destructive">
              *
            </span>
          ) : null}
        </p>

        {help ? (
          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
            <CollapsibleTrigger
              className={cn(
                'inline-flex items-center gap-1 rounded text-xs text-muted-foreground',
                'transition-colors hover:text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}>
              <ChevronRight
                className={cn(
                  'h-3 w-3 transition-transform motion-reduce:transition-none',
                  helpOpen && 'rotate-90',
                )}
                aria-hidden="true"
              />
              <span>{helpOpen ? t('hide') : t('show')}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5 text-xs text-muted-foreground">
              {help}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      <AnswerInput
        question={question}
        promptId={promptId}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />

      {citation ? <LegalReferenceCollapsible citation={citation} kind={legalKind} /> : null}
    </div>
  );
}

function AnswerInput({
  question,
  promptId,
  value,
  onChange,
  disabled,
}: {
  question: RuleSetQuestion;
  promptId: string;
  value?: WizardAnswerValue;
  onChange: (value: WizardAnswerValue) => void;
  disabled?: boolean;
}) {
  const name = `q__${question.id}`;

  const handleYesNo = useCallback(
    (v: YesNoValue) => onChange({ type: 'yes-no', value: v }),
    [onChange],
  );
  const handleLikert = useCallback(
    (v: LikertValue) => onChange({ type: 'likert-5', value: v }),
    [onChange],
  );
  const handleScore03 = useCallback(
    (v: Score03Value) => onChange({ type: 'score-0-3', value: v }),
    [onChange],
  );
  const handleBillingRatio = useCallback(
    (v: number) => onChange({ type: 'billing-ratio', value: v }),
    [onChange],
  );

  switch (question.answerType) {
    case 'yes-no':
      return (
        <YesNoAnswer
          name={name}
          value={value?.type === 'yes-no' ? value.value : undefined}
          onChange={handleYesNo}
          disabled={disabled}
          aria-labelledby={promptId}
        />
      );
    case 'likert-5':
      return (
        <LikertAnswer
          name={name}
          value={value?.type === 'likert-5' ? value.value : undefined}
          onChange={handleLikert}
          disabled={disabled}
          aria-labelledby={promptId}
        />
      );
    case 'score-0-3':
      return (
        <Score03Answer
          name={name}
          value={value?.type === 'score-0-3' ? value.value : undefined}
          onChange={handleScore03}
          disabled={disabled}
          aria-labelledby={promptId}
        />
      );
    case 'billing-ratio':
      return (
        <EconomicDependencyInput
          name={name}
          value={value?.type === 'billing-ratio' ? value.value : undefined}
          onCommit={handleBillingRatio}
          disabled={disabled}
        />
      );
    case 'rationale':
      // Rationale is rendered as an optional sibling by the step composer
      // where relevant — not dispatched here.
      return null;
    default:
      return null;
  }
}
