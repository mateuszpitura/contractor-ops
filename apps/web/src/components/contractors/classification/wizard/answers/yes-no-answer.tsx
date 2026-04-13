'use client';

// ---------------------------------------------------------------------------
// YesNoAnswer — 2-option RadioGroup for IR35 wizard
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 3 (answer input patterns) + §Accessibility Contract.

import { useId } from 'react';
import { useTranslations } from 'next-intl';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type YesNoValue = 'yes' | 'no';

export interface YesNoAnswerProps {
  /** Stable question id — used as the fieldset group name and for aria linkage. */
  name: string;
  /** Current selected value, or undefined when not yet answered. */
  value?: YesNoValue;
  onChange: (value: YesNoValue) => void;
  disabled?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export function YesNoAnswer({
  name,
  value,
  onChange,
  disabled,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: YesNoAnswerProps) {
  const t = useTranslations('Classification.yesNo');
  const yesId = useId();
  const noId = useId();

  return (
    <RadioGroup
      name={name}
      value={value ?? null}
      onValueChange={next => onChange(next as YesNoValue)}
      disabled={disabled}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
      <OptionCard
        inputId={yesId}
        optionValue="yes"
        selected={value === 'yes'}
        label={t('yes')}
      />
      <OptionCard
        inputId={noId}
        optionValue="no"
        selected={value === 'no'}
        label={t('no')}
      />
    </RadioGroup>
  );
}

function OptionCard({
  inputId,
  optionValue,
  selected,
  label,
}: {
  inputId: string;
  optionValue: YesNoValue;
  selected: boolean;
  label: string;
}) {
  return (
    <Label
      htmlFor={inputId}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 transition-colors',
        selected
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-input hover:bg-accent/50',
      )}>
      <RadioGroupItem id={inputId} value={optionValue} />
      <span className="text-sm font-medium">{label}</span>
    </Label>
  );
}
