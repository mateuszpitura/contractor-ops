'use client';

// ---------------------------------------------------------------------------
// LikertAnswer — 5-point Likert RadioGroup for IR35 wizard
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 3 and §Typography. Labels translated via
// `Classification.likert.*`.

import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { useTranslations } from 'next-intl';
import { useCallback, useId } from 'react';
import { cn } from '@/lib/utils';

export type LikertValue = 1 | 2 | 3 | 4 | 5;

const OPTIONS: ReadonlyArray<{
  value: LikertValue;
  key: 'stronglyDisagree' | 'disagree' | 'neutral' | 'agree' | 'stronglyAgree';
  emphasis: boolean;
}> = [
  { value: 1, key: 'stronglyDisagree', emphasis: true },
  { value: 2, key: 'disagree', emphasis: false },
  { value: 3, key: 'neutral', emphasis: false },
  { value: 4, key: 'agree', emphasis: false },
  { value: 5, key: 'stronglyAgree', emphasis: true },
] as const;

export interface LikertAnswerProps {
  name: string;
  value?: LikertValue;
  onChange: (value: LikertValue) => void;
  disabled?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export function LikertAnswer({
  name,
  value,
  onChange,
  disabled,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: LikertAnswerProps) {
  const t = useTranslations('Classification.likert');

  const handleValueChange = useCallback(
    (next: string) => onChange(Number(next) as LikertValue),
    [onChange],
  );

  return (
    <RadioGroup
      name={name}
      value={value == null ? null : String(value)}
      onValueChange={handleValueChange}
      disabled={disabled}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className="flex flex-col gap-2 lg:grid lg:grid-cols-5 lg:gap-2">
      {OPTIONS.map(opt => (
        <LikertOption
          key={opt.value}
          optionValue={opt.value}
          selected={value === opt.value}
          label={t(opt.key)}
          emphasis={opt.emphasis}
        />
      ))}
    </RadioGroup>
  );
}

function LikertOption({
  optionValue,
  selected,
  label,
  emphasis,
}: {
  optionValue: LikertValue;
  selected: boolean;
  label: string;
  emphasis: boolean;
}) {
  const inputId = useId();
  return (
    <Label
      htmlFor={inputId}
      className={cn(
        'flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors',
        selected
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-input hover:bg-accent/50',
      )}>
      <RadioGroupItem id={inputId} value={String(optionValue)} />
      <span className={cn('text-xs', emphasis ? 'font-semibold' : 'text-muted-foreground')}>
        {label}
      </span>
    </Label>
  );
}
