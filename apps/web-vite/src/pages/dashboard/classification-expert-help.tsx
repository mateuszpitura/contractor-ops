import { Navigate, useSearchParams } from 'react-router-dom';
import { Suspense } from 'react';

import { ClassificationAdvisoryBanner } from '../../components/classification/advisory-banner.js';
import { ClassificationGuard } from '../../components/classification/classification-guard.js';
import { ExpertHelpContent } from '../../components/classification/expert-help-content.js';
import { useClassificationExpertHelp } from '../../components/classification/hooks/use-classification-expert-help.js';
import { useFlag } from '../../components/layout/feature-flag-context.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { useLocale } from '../../i18n/navigation.js';

function ClassificationExpertHelpPageContent() {
  const locale = useLocale();
  const [searchParams] = useSearchParams();
  const assessmentId = searchParams.get('assessmentId');
  const classificationEnabled = useFlag('module.classification-engine');
  const { isPending, isDE, jurisdiction } = useClassificationExpertHelp();

  if (!classificationEnabled) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  if (isPending) {
    return <PageLoadingSpinner />;
  }

  return (
    <>
      <ClassificationAdvisoryBanner jurisdiction={jurisdiction} />
      <ExpertHelpContent isDE={isDE} assessmentId={assessmentId} expertReferralEmail={null} />
    </>
  );
}

export default function ClassificationExpertHelpPage() {
  return (
    <ClassificationGuard>
      <Suspense fallback={<PageLoadingSpinner />}>
        <ClassificationExpertHelpPageContent />
      </Suspense>
    </ClassificationGuard>
  );
}
