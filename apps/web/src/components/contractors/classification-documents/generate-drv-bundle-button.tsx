// Phase 59 · Plan 04 Task 2 — Generate DRV defense bundle button.
// Companion to GenerateSdsButton — same flow, different template + kind.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/trpc/init';

interface GenerateDrvBundleButtonProps {
  classificationAssessmentId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function GenerateDrvBundleButton({
  classificationAssessmentId,
  disabled,
  disabledReason,
}: GenerateDrvBundleButtonProps) {
  const t = useTranslations('Classification.documents');
  const queryClient = useQueryClient();
  const disabledReasonId = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation(
    trpc.classificationDocument.generateDrvDefenseBundle.mutationOptions({
      // P2-F · F-SCALE-02 — DRV defense bundle render now runs async via
      // QStash. The mutation returns `{ exportId, status: 'PENDING' }`;
      // the user gets the download link by email and via the in-app
      // exports panel.
      onSuccess: () => {
        setErrorMessage(null);
        void queryClient.invalidateQueries({
          queryKey: [['classificationDocument', 'listByEngagement']],
        });
        toast.success('Done.');
      },
      onError: err => {
        setErrorMessage(err.message);
        toast.error(err.message);
      },
    }),
  );

  const isPending = mutation.isPending;
  const isDisabled = Boolean(disabled) || isPending;

  const handleClick = useCallback(
    () => mutation.mutate({ classificationAssessmentId }),
    [mutation, classificationAssessmentId],
  );

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-describedby={disabled && disabledReason ? disabledReasonId : undefined}
        aria-busy={isPending}
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
        {isPending ? t('generating') : t('generateDrvBundle')}
      </button>
      {disabled && disabledReason ? (
        <p id={disabledReasonId} className="mt-2 text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{t('errorGenericTitle')}</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
