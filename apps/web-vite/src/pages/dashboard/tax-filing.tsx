import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import { Tax1042SBatchPanel } from '../../components/contractors/tax-filing/tax-1042s-batch-panel.js';
import { useFlag } from '../../components/layout/feature-flag-context.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

/**
 * Staff US 1042-S filing workspace. Dark behind `module.us-expansion` — the same
 * flag the `form1042s` router re-checks per request. The nav entry is already
 * flag-gated; this guard covers a direct navigation while the flag is off.
 * Review-before-file: the batch panel produces a reviewable withholding summary;
 * filing is a separate, deliberate action.
 */
function TaxFilingPageContent() {
  const t = useTranslations('Tax1042SBatch');
  const locale = useLocale();
  const { can } = usePermissions();
  const usExpansionEnabled = useFlag('module.us-expansion');

  if (!(usExpansionEnabled && can('contractor', ['read']))) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  return (
    <div className="space-y-section-gap">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>
      <AnimateIn delay={1}>
        <Tax1042SBatchPanel />
      </AnimateIn>
    </div>
  );
}

export default function TaxFilingPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <TaxFilingPageContent />
    </Suspense>
  );
}
