// Step 11 codemod port from apps/web/src/components/contractors/compliance/steuernummer-input.tsx.

import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { BundeslandCode } from '@contractor-ops/validators';
import { getSteuernummerFormat, getSteuernummerRegex } from '@contractor-ops/validators';
import { Check } from 'lucide-react';
import { useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

export interface SteuernummerInputProps {
  bundesland: BundeslandCode | undefined;
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
  label: string;
  id?: string;
  required?: boolean;
}

export function SteuernummerInput({
  bundesland,
  value,
  onChange,
  error,
  label,
  id,
  required = false,
}: SteuernummerInputProps) {
  const t = useTranslations('Contractors.steuernummer');
  const reactId = useId();
  const inputId = id ?? `steuernummer-${reactId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();

  const format = bundesland ? getSteuernummerFormat(bundesland) : undefined;
  const disabled = !bundesland;
  const placeholder = disabled ? t('selectBundeslandFirst') : (format?.example ?? '');
  const hint = format
    ? t('formatHint', { example: format.example, stateName: format.germanName })
    : undefined;

  const displayError = error ?? localError;
  const showValid =
    touched &&
    !displayError &&
    !!value &&
    !!bundesland &&
    getSteuernummerRegex(bundesland).test(value);

  const describedBy =
    [hint ? hintId : null, displayError ? errorId : null].filter(Boolean).join(' ') || undefined;

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
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => {
            setLocalError(undefined);
            onChange(e.target.value);
          }}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onBlur={() => {
            setTouched(true);
            if (bundesland && value) {
              const ok = getSteuernummerRegex(bundesland).test(value);
              if (!ok && format) {
                setLocalError(
                  t('formatMismatch', { stateName: format.germanName, example: format.example }),
                );
              }
            }
          }}
          className={cn(showValid && 'pe-8')}
        />
        {showValid ? (
          <Check
            role="img"
            aria-label={t('validFormat')}
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
