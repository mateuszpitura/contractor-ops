// Phase 59 · Plan 02 Task 3 — Classification documents panel for the engagement detail page.
// Gates the generate CTA on assessment completion + engagement country (GB for SDS).
// Plan 59-04 extends this panel with a GenerateDrvBundleButton for DE engagements.

'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { DocumentHistoryList } from './document-history-list';
import { GenerateDrvBundleButton } from './generate-drv-bundle-button';
import { GenerateSdsButton } from './generate-sds-button';

interface ClassificationDocumentsPanelProps {
  /** ContractorAssignment id (engagement). */
  engagementId: string;
  /** Country code of the engagement/contractor; gates the CTA set. */
  countryCode: string | null;
  /** Latest completed ClassificationAssessment id for this engagement, if any. */
  completedAssessmentId: string | null;
  /** Whether the contractor has signed the other-client attestation (gates DRV bundle button). */
  attestationSigned?: boolean;
}

export function ClassificationDocumentsPanel({
  engagementId,
  countryCode,
  completedAssessmentId,
  attestationSigned,
}: ClassificationDocumentsPanelProps) {
  const t = useTranslations('Classification.documents');
  const headingId = useId();
  const sdsDisabledId = useId();
  const drvDisabledId = useId();

  const isGb = countryCode === 'GB';
  const isDe = countryCode === 'DE';
  const canGenerateSds = Boolean(isGb && completedAssessmentId);
  const canGenerateDrv = Boolean(isDe && completedAssessmentId && attestationSigned);
  const drvDisabledReason = completedAssessmentId
    ? attestationSigned
      ? null
      : t('drvDisabledNeedAttestation')
    : t('drvDisabledNeedAssessment');

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card p-6">
      <header className="mb-4">
        <h2 id={headingId} className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-col gap-4">
        {isGb ? (
          canGenerateSds && completedAssessmentId ? (
            <GenerateSdsButton classificationAssessmentId={completedAssessmentId} />
          ) : (
            <div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-describedby={sdsDisabledId}
                className="inline-flex items-center rounded-md border bg-muted px-4 py-2 text-sm text-muted-foreground">
                {t('generateSds')}
              </button>
              <p id={sdsDisabledId} className="mt-2 text-xs text-muted-foreground">
                {t('generateDisabled')}
              </p>
            </div>
          )
        ) : null}

        {isDe ? (
          completedAssessmentId ? (
            <GenerateDrvBundleButton
              classificationAssessmentId={completedAssessmentId}
              disabled={!canGenerateDrv}
              disabledReason={drvDisabledReason ?? undefined}
            />
          ) : (
            <div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-describedby={drvDisabledId}
                className="inline-flex items-center rounded-md border bg-muted px-4 py-2 text-sm text-muted-foreground">
                {t('generateDrvBundle')}
              </button>
              <p id={drvDisabledId} className="mt-2 text-xs text-muted-foreground">
                {t('drvDisabledNeedAssessment')}
              </p>
            </div>
          )
        ) : null}

        <DocumentHistoryList engagementId={engagementId} />
      </div>
    </section>
  );
}
