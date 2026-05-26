import { Navigate, useSearchParams } from 'react-router-dom';

import { useLocale } from '../../i18n/navigation.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { ClassificationAdvisoryBanner } from './advisory-banner.js';
import { ExpertHelpContent } from './expert-help-content.js';
import { useClassificationExpertHelp } from './hooks/use-classification-expert-help.js';

export function ClassificationExpertHelpContainer() {
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
