'use client';

// ---------------------------------------------------------------------------
// EconomicDependencyInput — DRV § 2 Nr 9 SGB VI billing-ratio (0-100%).
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 3 (Economic-dependency billing-ratio). Saves on
// blur (not keystroke) — numeric field, no debounce needed. Inline error
// renders the UI-SPEC error copy without silently discarding the user's
// value (error reads back to them, they can correct in place).

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@contractor-ops/ui/components/shadcn/input-group';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface EconomicDependencyInputProps {
  name: string;
  /** Percentage 0-100, or undefined when not yet answered. */
  value?: number;
  /** Committed on blur — only fires when the value parses and passes Zod 0..100. */
  onCommit: (value: number) => void;
  disabled?: boolean;
}

export function EconomicDependencyInput({
  name,
  value,
  onCommit,
  disabled,
}: EconomicDependencyInputProps) {
  const t = useTranslations('Classification.billingRatio');
  const tError = useTranslations('Classification.error');
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();

  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  const [error, setError] = useState<string | null>(null);

  const handleBlur = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError(null);
      return;
    }

    const parsed = Number(trimmed);
    if (!(Number.isFinite(parsed) && Number.isInteger(parsed))) {
      setError(tError('nonNumeric'));
      return;
    }
    if (parsed < 0 || parsed > 100) {
      setError(tError('ratioOutOfRange'));
      return;
    }

    setError(null);
    onCommit(parsed);
  }, [draft, onCommit, tError]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    [],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
        {t('label')}
      </Label>
      <InputGroup className={cn('max-w-[180px]', error && 'border-destructive')}>
        <InputGroupInput
          id={inputId}
          name={name}
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          aria-invalid={error != null}
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <InputGroupAddon align="inline-end" aria-hidden="true">
          {t('suffix')}
        </InputGroupAddon>
      </InputGroup>
      <span id={helpId} className="text-xs text-muted-foreground">
        {t('help')}
      </span>
      {error ? (
        <span id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
