// Generate SDS button — extended with an SDS approval gate.
//
// Triggers the classificationDocument.generateSds mutation and opens the returned
// 300s signed R2 URL in a new tab. Before generating, requires the user to
// confirm client approval via classification.approveSds.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { SDS_APPROVAL_STATEMENT_EN } from '@contractor-ops/validators';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useGenerateSds as UseGenerateSds } from '../hooks/use-classification-documents.js';
import { useGenerateSds } from '../hooks/use-classification-documents.js';

export interface GenerateSdsButtonProps {
  classificationAssessmentId: string;
  /** Pass true if the assessment already has an SdsApproval row (avoids re-showing the gate) */
  alreadyApproved?: boolean;
}

type GenerateSdsButtonViewProps = GenerateSdsButtonProps & ReturnType<typeof UseGenerateSds>;

export function GenerateSdsButtonView({
  classificationAssessmentId,
  alreadyApproved = false,
  approveSdsMutation,
  generateMutation,
  generateSds,
}: GenerateSdsButtonViewProps) {
  const t = useTranslations('Classification.documents');
  const tApproval = useTranslations('Legal.SdsApproval');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approved, setApproved] = useState(alreadyApproved);
  const [clientName, setClientName] = useState('');
  const [checked, setChecked] = useState(false);

  const handleGenerateClick = useCallback(() => {
    setErrorMessage(null);
    generateSds();
  }, [generateSds]);

  const handleApproveClick = useCallback(() => {
    setErrorMessage(null);
    approveSdsMutation.mutate(
      {
        assessmentId: classificationAssessmentId,
        clientName: clientName.trim(),
      },
      {
        onSuccess: () => {
          setApproved(true);
          setErrorMessage(null);
        },
        onError: err => setErrorMessage(err.message),
      },
    );
  }, [approveSdsMutation, classificationAssessmentId, clientName]);

  const handleClientNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setClientName(e.target.value),
    [],
  );

  const handleApprovalCheckedChange = useCallback((c: boolean) => setChecked(c === true), []);

  return (
    <div>
      {/* SDS approval gate — must confirm client approval before generating */}
      {!approved && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium">{tApproval('gateTitle')}</p>

          <div className="space-y-1.5">
            <Label htmlFor="sds-client-name">{tApproval('clientNameLabel')}</Label>
            <Input
              id="sds-client-name"
              value={clientName}
              onChange={handleClientNameChange}
              placeholder={tApproval('clientNamePlaceholder')}
              maxLength={500}
              className="bg-white"
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="sds-approval-checkbox"
              checked={checked}
              onCheckedChange={handleApprovalCheckedChange}
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

      {errorMessage || approveSdsMutation.error || generateMutation.error ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{t('errorGenericTitle')}</p>
          <p className="mt-1">
            {errorMessage ?? approveSdsMutation.error?.message ?? generateMutation.error?.message}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function GenerateSdsButton(props: GenerateSdsButtonProps) {
  const sds = useGenerateSds(props.classificationAssessmentId);
  return <GenerateSdsButtonView {...props} {...sds} />;
}
