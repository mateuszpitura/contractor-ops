// apps/web/src/components/contractors/peppol-identifier-fields.tsx
//
// Phase 61 · Plan 61-07 — Reusable Contractor Peppol identifier field group.
//
// Two fields (`peppolSchemeId`, `peppolParticipantValue`). Enforces the
// Plan 04 pair constraint (D-11) via `peppolParticipantPairSchema` — the
// user must either provide both fields or leave both blank. Half-set pairs
// surface an inline `role="alert"` error.
//
// Controlled variant: the parent form owns the state; this component is a
// pure presentational field group with local pair-error derivation.

'use client';

import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { peppolParticipantPairSchema } from '@contractor-ops/validators';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PeppolIdentifierFieldsValue {
  schemeId: string;
  value: string;
}

interface PeppolIdentifierFieldsProps {
  value: PeppolIdentifierFieldsValue;
  onChange: (next: PeppolIdentifierFieldsValue) => void;
  onValidChange?: (ok: boolean) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeppolIdentifierFields({
  value,
  onChange,
  onValidChange,
  disabled,
}: PeppolIdentifierFieldsProps) {
  const t = useTranslations('EInvoice.PeppolDialog');
  const schemeId = useId();
  const valueId = useId();
  const pairErrId = `${schemeId}-pair-err`;

  const scheme = value.schemeId.trim();
  const peppolValue = value.value.trim();

  const pair = useMemo(() => {
    const parsed = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: scheme === '' ? null : scheme,
      peppolParticipantValue: peppolValue === '' ? null : peppolValue,
    });
    if (parsed.success) return { ok: true, error: null as string | null };
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? 'Invalid Peppol identifier pair' };
  }, [scheme, peppolValue]);

  const prevOkRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevOkRef.current !== pair.ok) {
      prevOkRef.current = pair.ok;
      onValidChange?.(pair.ok);
    }
  }, [pair.ok, onValidChange]);

  const invalid = !pair.ok && (scheme.length > 0 || peppolValue.length > 0);

  return (
    <fieldset
      className={cn('space-y-3 rounded-md border p-4', disabled && 'opacity-60')}
      data-testid="peppol-identifier-fields">
      <legend className="px-1 text-sm font-medium">{t('peppolIdentifierLegend')}</legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={schemeId}>{t('schemeLabel')}</Label>
          <Input
            id={schemeId}
            name="peppolSchemeId"
            value={value.schemeId}
            onChange={e => onChange({ schemeId: e.target.value, value: value.value })}
            disabled={disabled}
            maxLength={4}
            inputMode="numeric"
            pattern="\d{4}"
            aria-invalid={invalid}
            aria-describedby={invalid ? pairErrId : undefined}
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">{t('schemeHelper')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={valueId}>{t('valueLabel')}</Label>
          <Input
            id={valueId}
            name="peppolParticipantValue"
            value={value.value}
            onChange={e => onChange({ schemeId: value.schemeId, value: e.target.value })}
            disabled={disabled}
            maxLength={64}
            aria-invalid={invalid}
            aria-describedby={invalid ? pairErrId : undefined}
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">{t('valueHelper')}</p>
        </div>
      </div>

      {invalid ? (
        <p id={pairErrId} role="alert" className="text-sm text-destructive">
          {t('pairError')}
        </p>
      ) : null}
    </fieldset>
  );
}
