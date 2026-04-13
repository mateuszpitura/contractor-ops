// Phase 59 · Plan 03 Task 4 — Other-client attestation form.
// Captures the contractor's free-text "other clients" statement + typed
// signature. Persists via ir35Attestation.upsert (Plan 59-04 DRV bundle
// Section 4 consumes the stored row).

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { trpc } from '@/trpc/init';

interface OtherClientAttestationFormProps {
  engagementId: string;
}

export function OtherClientAttestationForm({ engagementId }: OtherClientAttestationFormProps) {
  const t = useTranslations('OtherClientAttestation');
  const queryClient = useQueryClient();

  const [statementText, setStatementText] = useState('');
  const [signedName, setSignedName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const existingQuery = useQuery(
    trpc.ir35Attestation.getForEngagement.queryOptions({ contractorAssignmentId: engagementId }),
  );

  useEffect(() => {
    if (existingQuery.data) {
      setStatementText(existingQuery.data.statementText);
      setSignedName(existingQuery.data.signedName);
    }
  }, [existingQuery.data]);

  const mutation = useMutation(
    trpc.ir35Attestation.upsert.mutationOptions({
      onSuccess: () => {
        setErrorMessage(null);
        void queryClient.invalidateQueries({
          queryKey: [['ir35Attestation', 'getForEngagement']],
        });
      },
      onError: err => setErrorMessage(err.message),
    }),
  );

  return (
    <section
      aria-labelledby="other-client-attestation-heading"
      className="rounded-lg border bg-card p-6"
    >
      <header className="mb-4">
        <h2 id="other-client-attestation-heading" className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <form
        onSubmit={event => {
          event.preventDefault();
          mutation.mutate({
            contractorAssignmentId: engagementId,
            statementText,
            signedName,
          });
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('statementLabel')}</span>
          <textarea
            required
            value={statementText}
            onChange={event => setStatementText(event.target.value)}
            maxLength={4000}
            rows={6}
            className="rounded-md border px-2 py-1.5"
            aria-describedby="statement-hint"
          />
          <span id="statement-hint" className="text-xs text-muted-foreground">
            {t('statementHint', { max: 4000 })}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('signedNameLabel')}</span>
          <input
            required
            type="text"
            value={signedName}
            onChange={event => setSignedName(event.target.value)}
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
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? t('saving') : existingQuery.data ? t('update') : t('submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
