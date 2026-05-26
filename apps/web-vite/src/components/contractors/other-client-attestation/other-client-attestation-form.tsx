// Phase 59 · Plan 03 Task 4 — Other-client attestation form.
// Captures the contractor's free-text "other clients" statement + typed
// signature. Persists via ir35Attestation.upsert (Plan 59-04 DRV bundle
// Section 4 consumes the stored row).

import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useOtherClientAttestation } from '../hooks/use-other-client-attestation.js';

export interface OtherClientAttestationFormProps {
  engagementId: string;
}

type OtherClientAttestationFormViewProps = OtherClientAttestationFormProps &
  ReturnType<typeof useOtherClientAttestation>;

export function OtherClientAttestationFormView({
  engagementId,
  existing,
  mutation,
  isPending,
}: OtherClientAttestationFormViewProps) {
  const t = useTranslations('OtherClientAttestation');
  const headingId = useId();
  const statementHintId = useId();

  const [statementText, setStatementText] = useState('');
  const [signedName, setSignedName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setStatementText(existing.statementText);
      setSignedName(existing.signedName);
    }
  }, [existing]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage(null);
      mutation.mutate(
        {
          contractorAssignmentId: engagementId,
          statementText,
          signedName,
        },
        {
          onError: err => setErrorMessage(err.message),
        },
      );
    },
    [mutation, engagementId, statementText, signedName],
  );

  const handleStatementChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setStatementText(event.target.value),
    [],
  );

  const handleSignedNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSignedName(event.target.value),
    [],
  );

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-6">
      <header className="mb-4">
        <h2 id={headingId} className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('statementLabel')}</span>
          <textarea
            required
            value={statementText}
            onChange={handleStatementChange}
            maxLength={4000}
            rows={6}
            className="rounded-md border px-2 py-1.5"
            aria-describedby={statementHintId}
          />
          <span id={statementHintId} className="text-xs text-muted-foreground">
            {t('statementHint', { max: 4000 })}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('signedNameLabel')}</span>
          <input
            required
            type="text"
            value={signedName}
            onChange={handleSignedNameChange}
            maxLength={200}
            className="rounded-md border px-2 py-1.5"
          />
        </label>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
            {isPending ? t('saving') : existing ? t('update') : t('submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
