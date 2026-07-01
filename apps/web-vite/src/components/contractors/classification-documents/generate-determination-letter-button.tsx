// Generate determination-letter button — an SDS-mirror approval gate.
//
// Before generating, the operator types the client/recipient name and confirms
// they reviewed the scored factors, flags, and citations. Only then is the
// primary "Generate determination letter" CTA enabled. Generation is enqueued
// (aria-busy while pending); the archived letter appears in the document-history
// list, from which it downloads via a signed R2 URL. Errors surface with
// role="alert".

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useGenerateDeterminationLetter as UseGenerateDeterminationLetter } from './hooks/use-generate-determination-letter.js';
import { useGenerateDeterminationLetter } from './hooks/use-generate-determination-letter.js';

export interface GenerateDeterminationLetterButtonProps {
  classificationAssessmentId: string;
}

type ViewProps = GenerateDeterminationLetterButtonProps &
  ReturnType<typeof UseGenerateDeterminationLetter>;

export function GenerateDeterminationLetterButtonView({ generateMutation, generate }: ViewProps) {
  const t = useTranslations('UsClassification.letter');
  const clientNameId = useId();
  const approvalCheckboxId = useId();
  const [clientName, setClientName] = useState('');
  const [checked, setChecked] = useState(false);

  const approved = checked && clientName.trim().length > 0;

  const handleClientNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setClientName(e.target.value),
    [],
  );
  const handleCheckedChange = useCallback(
    (c: boolean | 'indeterminate') => setChecked(c === true),
    [],
  );
  const handleGenerateClick = useCallback(() => generate(), [generate]);

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium">{t('gateTitle')}</p>

        <div className="space-y-1.5">
          <Label htmlFor={clientNameId}>{t('clientNameLabel')}</Label>
          <Input
            id={clientNameId}
            value={clientName}
            onChange={handleClientNameChange}
            placeholder={t('clientNamePlaceholder')}
            maxLength={500}
            className="bg-white"
          />
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id={approvalCheckboxId}
            checked={checked}
            onCheckedChange={handleCheckedChange}
          />
          <Label
            htmlFor={approvalCheckboxId}
            className="text-xs leading-relaxed text-muted-foreground">
            {t('approvalStatement')}
          </Label>
        </div>

        <Button
          type="button"
          onClick={handleGenerateClick}
          disabled={!approved || generateMutation.isPending}
          aria-busy={generateMutation.isPending}
          size="sm">
          {generateMutation.isPending ? t('generating') : t('generate')}
        </Button>
      </div>

      {generateMutation.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{t('errorTitle')}</p>
          <p className="mt-1">{generateMutation.error.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export function GenerateDeterminationLetterButton(props: GenerateDeterminationLetterButtonProps) {
  const letter = useGenerateDeterminationLetter(props.classificationAssessmentId);
  return <GenerateDeterminationLetterButtonView {...props} {...letter} />;
}
