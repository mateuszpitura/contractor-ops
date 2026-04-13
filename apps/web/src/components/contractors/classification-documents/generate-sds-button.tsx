// Phase 59 · Plan 02 Task 3 — Generate SDS button.
// Triggers the classificationDocument.generateSds mutation and opens the returned
// 300s signed R2 URL in a new tab.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { trpc } from '@/trpc/init';

interface GenerateSdsButtonProps {
  classificationAssessmentId: string;
}

export function GenerateSdsButton({ classificationAssessmentId }: GenerateSdsButtonProps) {
  const t = useTranslations('Classification.documents');
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation(
    trpc.classificationDocument.generateSds.mutationOptions({
      onSuccess: data => {
        setErrorMessage(null);
        window.open(data.url, '_blank', 'noopener,noreferrer');
        void queryClient.invalidateQueries({
          queryKey: [['classificationDocument', 'listByEngagement']],
        });
      },
      onError: err => {
        setErrorMessage(err.message);
      },
    }),
  );

  const isPending = mutation.isPending;

  return (
    <div>
      <button
        type="button"
        onClick={() => mutation.mutate({ classificationAssessmentId })}
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {isPending ? t('generating') : t('generateSds')}
      </button>
      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="font-medium">{t('errorGenericTitle')}</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
