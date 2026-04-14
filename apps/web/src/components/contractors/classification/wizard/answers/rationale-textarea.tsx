'use client';

// ---------------------------------------------------------------------------
// RationaleTextarea — optional free-text rationale with max=1000 char counter
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 3 (Optional rationale textarea) + §Error states.
// The counter is aria-describedby'd to the textarea so assistive tech
// announces remaining character budget.

import { useTranslations } from 'next-intl';
import { useCallback, useId, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MAX_RATIONALE_LENGTH = 1000;
const DESTRUCTIVE_THRESHOLD = 950;

export interface RationaleTextareaProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function RationaleTextarea({
  name,
  value = '',
  onChange,
  onBlur,
  disabled,
}: RationaleTextareaProps) {
  const t = useTranslations('Classification.rationale');
  const textareaId = useId();
  const counterId = useId();

  const current = value.length;
  const overLimit = current > MAX_RATIONALE_LENGTH;
  const approaching = current > DESTRUCTIVE_THRESHOLD;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value),
    [onChange],
  );

  const counterMessage = useMemo(
    () => t('counter', { current, max: MAX_RATIONALE_LENGTH }),
    [t, current],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={textareaId} className="text-xs font-medium text-muted-foreground">
        {t('label')}
      </Label>
      <Textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        maxLength={MAX_RATIONALE_LENGTH}
        aria-describedby={counterId}
        placeholder={t('placeholder')}
        className="min-h-20 text-sm"
      />
      <span
        id={counterId}
        className={cn(
          'self-end text-xs tabular-nums',
          overLimit || approaching ? 'text-destructive' : 'text-muted-foreground',
        )}>
        {counterMessage}
      </span>
    </div>
  );
}
