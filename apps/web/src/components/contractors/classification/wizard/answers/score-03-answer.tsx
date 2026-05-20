'use client';

// ---------------------------------------------------------------------------
// Score03Answer — DRV 0/1/2/3 scoring scale with explicit Nicht-anwendbar.
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 3 + §Copywriting Contract. The rawScore === 0
// option renders the LOCKED DE label `CLASSIFICATION_SCHEIN_NOT_APPLICABLE`
// verbatim (imported from @contractor-ops/validators); non-DE locales use
// `Classification.stepNotApplicable`. Pitfall 5 — emits the discriminated
// payload { rawScore: 0, isNotApplicable: true } for N/A so the scoring
// engine can distinguish "not applicable" from "missing".

import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { CLASSIFICATION_SCHEIN_NOT_APPLICABLE } from '@contractor-ops/validators';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useId } from 'react';
import { cn } from '@/lib/utils';

export type Score03Value = {
  rawScore: 0 | 1 | 2 | 3;
  isNotApplicable: boolean;
};

/**
 * Map from the radio transport value (a string) to the discriminated payload.
 * The "0" option is always N/A; 1/2/3 are scored indicators.
 */
const OPTIONS: ReadonlyArray<{
  transport: '0' | '1' | '2' | '3';
  labelKey: 'weak' | 'moderate' | 'strong' | null;
  payload: Score03Value;
}> = [
  { transport: '0', labelKey: null, payload: { rawScore: 0, isNotApplicable: true } },
  { transport: '1', labelKey: 'weak', payload: { rawScore: 1, isNotApplicable: false } },
  { transport: '2', labelKey: 'moderate', payload: { rawScore: 2, isNotApplicable: false } },
  { transport: '3', labelKey: 'strong', payload: { rawScore: 3, isNotApplicable: false } },
] as const;

export interface Score03AnswerProps {
  name: string;
  value?: Score03Value;
  onChange: (value: Score03Value) => void;
  disabled?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export function Score03Answer({
  name,
  value,
  onChange,
  disabled,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: Score03AnswerProps) {
  const locale = useLocale();
  const tScore = useTranslations('Classification.score03');
  const tCommon = useTranslations('Classification');

  // DE locale: render the LOCKED legal constant verbatim.
  // Other locales: use the chrome translation `stepNotApplicable`.
  const notApplicableLabel =
    locale === 'de' ? CLASSIFICATION_SCHEIN_NOT_APPLICABLE : tCommon('stepNotApplicable');

  const currentTransport: '0' | '1' | '2' | '3' | null =
    value === undefined
      ? null
      : value.isNotApplicable
        ? '0'
        : (String(value.rawScore) as '1' | '2' | '3');

  const handleValueChange = useCallback(
    (next: string) => {
      const picked = OPTIONS.find(o => o.transport === next);
      if (picked) onChange(picked.payload);
    },
    [onChange],
  );

  return (
    <RadioGroup
      name={name}
      value={currentTransport}
      onValueChange={handleValueChange}
      disabled={disabled}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className="flex flex-col gap-2">
      {OPTIONS.map(opt => {
        const selected =
          value !== undefined &&
          ((opt.transport === '0' && value.isNotApplicable) ||
            (opt.transport !== '0' &&
              !value.isNotApplicable &&
              String(value.rawScore) === opt.transport));
        const label = opt.labelKey === null ? notApplicableLabel : tScore(opt.labelKey);
        return (
          <Score03Option
            key={opt.transport}
            transport={opt.transport}
            selected={selected}
            label={label}
          />
        );
      })}
    </RadioGroup>
  );
}

function Score03Option({
  transport,
  selected,
  label,
}: {
  transport: '0' | '1' | '2' | '3';
  selected: boolean;
  label: string;
}) {
  const inputId = useId();
  return (
    <Label
      htmlFor={inputId}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 transition-colors',
        selected
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-input hover:bg-accent/50',
      )}>
      <RadioGroupItem id={inputId} value={transport} />
      <span className="tabular-nums text-xs font-semibold text-muted-foreground">{transport}</span>
      <span className="text-sm">{label}</span>
    </Label>
  );
}
