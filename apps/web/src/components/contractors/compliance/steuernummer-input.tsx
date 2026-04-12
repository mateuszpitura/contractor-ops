'use client';

import { Check } from 'lucide-react';
import { useId, useState } from 'react';
import {
  getSteuernummerFormat,
  getSteuernummerRegex,
  type BundeslandCode,
} from '@contractor-ops/validators';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface SteuernummerInputProps {
  bundesland: BundeslandCode | undefined;
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
  label: string;
  id?: string;
  required?: boolean;
}

/**
 * Bundesland-aware Steuernummer input.
 *
 * Renders a native `<input>` that:
 *   1. Is `disabled` until the user has selected a Bundesland — the placeholder
 *      prompts them to do so first.
 *   2. Once a Bundesland is chosen, the placeholder becomes that state's
 *      canonical example and the helper text below shows the expected format.
 *   3. On blur, the input is validated against the per-Bundesland regex from
 *      `@contractor-ops/validators`. Invalid input triggers an inline error;
 *      valid input shows a `Check` icon with accessible name "Valid format".
 *
 * The Zod schema on the server re-runs the same regex (see
 * `deCountryFieldsSchema.superRefine`), so the client validator is strictly a
 * UX aid — `validateCountryFields` is the enforcement boundary.
 */
export function SteuernummerInput({
  bundesland,
  value,
  onChange,
  error,
  label,
  id,
  required = false,
}: SteuernummerInputProps) {
  const reactId = useId();
  const inputId = id ?? `steuernummer-${reactId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();

  const format = bundesland ? getSteuernummerFormat(bundesland) : undefined;
  const disabled = !bundesland;
  const placeholder = disabled
    ? 'Select Bundesland first'
    : format?.example ?? '';
  const hint = format
    ? `Format: ${format.example} · ${format.germanName}`
    : undefined;

  const displayError = error ?? localError;
  const showValid =
    touched &&
    !displayError &&
    !!value &&
    !!bundesland &&
    getSteuernummerRegex(bundesland).test(value);

  const describedBy = [hint ? hintId : null, displayError ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-destructive">
            *
          </span>
        ) : null}
      </Label>
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          aria-required={required ? 'true' : undefined}
          aria-invalid={displayError ? 'true' : undefined}
          aria-describedby={describedBy}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={e => {
            setLocalError(undefined);
            onChange(e.target.value);
          }}
          onBlur={() => {
            setTouched(true);
            if (bundesland && value) {
              const ok = getSteuernummerRegex(bundesland).test(value);
              if (!ok && format) {
                setLocalError(
                  `Steuernummer format does not match ${format.germanName}. Example: ${format.example}.`,
                );
              }
            }
          }}
          className={cn(showValid && 'pe-8')}
        />
        {showValid ? (
          <Check
            role="img"
            aria-label="Valid format"
            className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-success"
            size={16}
          />
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {displayError ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
