// Phase 59 · Plan 02 Task 3 — Classification documents panel for the engagement detail page.
// Gates the generate CTA on assessment completion + engagement country (GB for SDS).
// Plan 59-04 extends this panel with a GenerateDrvBundleButton for DE engagements.

'use client';

import { useTranslations } from 'next-intl';

import { DocumentHistoryList } from './document-history-list';
import { GenerateSdsButton } from './generate-sds-button';

interface ClassificationDocumentsPanelProps {
  /** ContractorAssignment id (engagement). */
  engagementId: string;
  /** Country code of the engagement/contractor; gates the CTA set. */
  countryCode: string | null;
  /** Latest completed ClassificationAssessment id for this engagement, if any. */
  completedAssessmentId: string | null;
}

export function ClassificationDocumentsPanel({
  engagementId,
  countryCode,
  completedAssessmentId,
}: ClassificationDocumentsPanelProps) {
  const t = useTranslations('Classification.documents');

  const isGb = countryCode === 'GB';
  const canGenerateSds = Boolean(isGb && completedAssessmentId);

  return (
    <section
      aria-labelledby="classification-documents-heading"
      className="rounded-lg border bg-card p-6"
    >
      <header className="mb-4">
        <h2 id="classification-documents-heading" className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-col gap-4">
        {canGenerateSds && completedAssessmentId ? (
          <GenerateSdsButton classificationAssessmentId={completedAssessmentId} />
        ) : (
          <div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-describedby="generate-sds-disabled-reason"
              className="inline-flex items-center rounded-md border bg-muted px-4 py-2 text-sm text-muted-foreground"
            >
              {t('generateSds')}
            </button>
            <p
              id="generate-sds-disabled-reason"
              className="mt-2 text-xs text-muted-foreground"
            >
              {t('generateDisabled')}
            </p>
          </div>
        )}

        <DocumentHistoryList engagementId={engagementId} />
      </div>
    </section>
  );
}
