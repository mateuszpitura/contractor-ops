import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { TaxFormSubmissionInput } from '@contractor-ops/validators';
import { Loader2 } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { useWatch } from 'react-hook-form';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormType } from './hooks/use-tax-form-wizard.js';

export interface StepAttestProps {
  fieldId: string;
  formType: TaxFormType;
  /** The contractor's legal name on file — the typed signature must match it. */
  legalName: string;
  register: UseFormRegister<TaxFormSubmissionInput>;
  control: Control<TaxFormSubmissionInput>;
  setValue: UseFormSetValue<TaxFormSubmissionInput>;
  errors: FieldErrors<TaxFormSubmissionInput>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  /** True when the last submit failed — drives the inline alert (data preserved). */
  submitError: boolean;
  onBack: () => void;
}

const PERJURY_KEYS: Record<TaxFormType, string> = {
  W9: 'perjury.w9',
  W8BEN: 'perjury.w8ben',
  W8BENE: 'perjury.w8bene',
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Attestation step. The contractor checks each "under penalties of perjury"
 * certification, types their full legal name (which must match the name on file),
 * and affirms the legal signature. `Sign & submit` stays disabled until every
 * gate is satisfied — intentional friction, not a destructive-delete dialog. The
 * perjury certifications are real `<input type="checkbox">` controls so the
 * attestation is a genuine affirmative act. The server re-derives the IP,
 * timestamp, and identity for the immutable record.
 */
export function StepAttest({
  fieldId,
  formType,
  legalName,
  register,
  control,
  setValue,
  errors: _errors,
  onSubmit,
  isSubmitting,
  submitError,
  onBack,
}: StepAttestProps) {
  const t = useTranslations('TaxFormWizard.attest');
  const tPerjury = useTranslations('TaxFormWizard');
  const tNav = useTranslations('TaxFormWizard.nav');
  const localId = useId();

  const [perjuryChecked, setPerjuryChecked] = useState(false);
  const [signatureAffirmed, setSignatureAffirmed] = useState(false);

  const typedName = useWatch({ control, name: 'signerName' }) ?? '';
  const nameMatches = legalName.length > 0 && normalizeName(typedName) === normalizeName(legalName);

  const canSubmit = perjuryChecked && signatureAffirmed && nameMatches && !isSubmitting;

  const handlePerjuryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setPerjuryChecked(checked);
      // `perjuryAccepted` is `z.literal(true)` — never write `false`.
      // Unset it on uncheck so the resolver re-validates cleanly when
      // the box is checked again (a stale `false` would block submit).
      setValue('perjuryAccepted', checked ? true : (undefined as never), {
        shouldValidate: true,
      });
    },
    [setValue],
  );

  const handleSignatureChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setSignatureAffirmed(event.target.checked),
    [],
  );

  const errorId = `${localId}-submit-error`;

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-card-gap" noValidate>
          <fieldset className="space-y-card-gap">
            <legend className="text-sm font-normal">{t('certificationsLabel')}</legend>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id={`${fieldId}-perjury`}
                className="mt-1 size-4 accent-primary"
                checked={perjuryChecked}
                onChange={handlePerjuryChange}
              />
              <Label htmlFor={`${fieldId}-perjury`} className="font-normal text-sm leading-snug">
                {tPerjury(PERJURY_KEYS[formType])}
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id={`${fieldId}-signature`}
                className="mt-1 size-4 accent-primary"
                checked={signatureAffirmed}
                onChange={handleSignatureChange}
              />
              <Label htmlFor={`${fieldId}-signature`} className="font-normal text-sm leading-snug">
                {t('signatureAffirmation')}
              </Label>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-signer`} className="font-normal text-sm">
              {t('typedNameLabel')}
            </Label>
            <Input
              id={`${fieldId}-signer`}
              autoComplete="name"
              placeholder={legalName}
              {...register('signerName')}
            />
            <p className="text-xs text-muted-foreground">{t('typedNameHelp')}</p>
          </div>

          {submitError ? (
            <p
              id={errorId}
              role="alert"
              aria-live="polite"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {t('submitError')}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              type="submit"
              className="w-full sm:flex-1"
              disabled={!canSubmit}
              aria-describedby={submitError ? errorId : undefined}>
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                  {t('submitting')}
                </>
              ) : (
                t('signSubmit')
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1"
              onClick={onBack}
              disabled={isSubmitting}>
              {tNav('back')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
