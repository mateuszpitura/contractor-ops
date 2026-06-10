// Generate DRV defense bundle button.
// Companion to GenerateSdsButton — same flow, different template + kind.

import { useCallback, useId, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useGenerateDrvBundle as UseGenerateDrvBundle } from '../hooks/use-classification-documents.js';
import { useGenerateDrvBundle } from '../hooks/use-classification-documents.js';

export interface GenerateDrvBundleButtonProps {
  classificationAssessmentId: string;
  disabled?: boolean;
  disabledReason?: string;
}

type GenerateDrvBundleButtonViewProps = GenerateDrvBundleButtonProps &
  ReturnType<typeof UseGenerateDrvBundle>;

export function GenerateDrvBundleButtonView({
  disabled,
  disabledReason,
  mutation,
  generate,
  isPending,
}: GenerateDrvBundleButtonViewProps) {
  const t = useTranslations('Classification.documents');
  const disabledReasonId = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDisabled = Boolean(disabled) || isPending;

  const handleClick = useCallback(() => {
    setErrorMessage(null);
    generate();
  }, [generate]);

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
      {errorMessage || mutation.error ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{t('errorGenericTitle')}</p>
          <p className="mt-1">{errorMessage ?? mutation.error?.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export function GenerateDrvBundleButton(props: GenerateDrvBundleButtonProps) {
  const drv = useGenerateDrvBundle(props.classificationAssessmentId);
  return <GenerateDrvBundleButtonView {...props} {...drv} />;
}
