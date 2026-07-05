import { Suspense } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { AnimateIn } from '../shared/animate-in.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { PayrollExportContainer } from './payroll-export-container.js';

/**
 * Payroll export — thin flag-gated composer.
 *
 * When `module.workforce-employees` is OFF the entire surface is removed from
 * the render tree. All data access lives in the section hook; the page composes
 * only the header and the export section.
 */
export function PayrollExportPage() {
  const workforceEnabled = useFlag('module.workforce-employees');
  if (!workforceEnabled) return null;

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PayrollExportPageContent />
    </Suspense>
  );
}

function PayrollExportPageContent() {
  const t = useTranslations('PayrollExport');

  return (
    <main aria-label={t('pageTitle')} className="space-y-section-gap">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>
      <AnimateIn delay={1}>
        <PayrollExportContainer />
      </AnimateIn>
    </main>
  );
}
