// Phase 59 · Plan 02 Task 3 — Generate SDS button.
// Phase 64 · D-22 — Extended with SDS approval gate (LEGAL-05).
//
// Triggers the classificationDocument.generateSds mutation and opens the returned
// 300s signed R2 URL in a new tab. Before generating, requires the user to
// confirm client approval via classification.approveSds.

'use client';

import { SDS_APPROVAL_STATEMENT_EN } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/trpc/init';

interface GenerateSdsButtonProps {
  classificationAssessmentId: string;
  /** Pass true if the assessment already has an SdsApproval row (avoids re-showing the gate) */
  alreadyApproved?: boolean;
}

export function GenerateSdsButton({
  classificationAssessmentId,
  alreadyApproved = false,
}: GenerateSdsButtonProps) {
  const t = useTranslations('Classification.documents');
  const tApproval = useTranslations('Legal.SdsApproval');
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approved, setApproved] = useState(alreadyApproved);
  const [clientName, setClientName] = useState('');
  const [checked, setChecked] = useState(false);

  const approveSdsMutation = useMutation(
    trpc.classification.approveSds.mutationOptions({
      onSuccess: () => {
        setApproved(true);
        setErrorMessage(null);
      },
      onError: err => {
        setErrorMessage(err.message);
      },
    }),
  );

  const generateMutation = useMutation(
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

  const handleGenerateClick = useCallback(
    () => generateMutation.mutate({ classificationAssessmentId }),
    [generateMutation, classificationAssessmentId],
  );

  const handleApproveClick = useCallback(
    () =>
      approveSdsMutation.mutate({
        assessmentId: classificationAssessmentId,
        clientName: clientName.trim(),
      }),
    [approveSdsMutation, classificationAssessmentId, clientName],
  );

  return (
    <div>
      {/* Phase 64 D-22 — SDS approval gate */}
      {!approved && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium">{tApproval('gateTitle')}</p>

          <div className="space-y-1.5">
            <Label htmlFor="sds-client-name">{tApproval('clientNameLabel')}</Label>
            <Input
              id="sds-client-name"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder={tApproval('clientNamePlaceholder')}
              maxLength={500}
              className="bg-white"
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="sds-approval-checkbox"
              checked={checked}
              onCheckedChange={c => setChecked(c === true)}
            />
            <Label
              htmlFor="sds-approval-checkbox"
              className="text-xs leading-relaxed text-muted-foreground">
              {SDS_APPROVAL_STATEMENT_EN}
            </Label>
          </div>

          <Button
            onClick={handleApproveClick}
            disabled={!(checked && clientName.trim()) || approveSdsMutation.isPending}
            size="sm">
            {approveSdsMutation.isPending
              ? tApproval('confirmingApproval')
              : tApproval('confirmApproval')}
          </Button>
        </div>
      )}

      {/* Generate SDS button — shown after approval */}
      {approved && (
        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={generateMutation.isPending}
          aria-busy={generateMutation.isPending}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
          {generateMutation.isPending ? t('generating') : t('generateSds')}
        </button>
      )}

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
