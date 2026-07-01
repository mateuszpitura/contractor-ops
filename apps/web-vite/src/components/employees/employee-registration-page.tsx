import { Suspense } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { AnimateIn } from '../shared/animate-in.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { EmployeeComplianceSection } from './compliance/employee-compliance-section.js';

/**
 * Employee registration — thin flag-gated composer.
 *
 * When `module.workforce-employees` is OFF the entire surface is removed from
 * the render tree (no skeleton, no disabled stub). All data access lives in the
 * wired section's hooks; the page composes only the header and section.
 */
export function EmployeeRegistrationPage() {
  const workforceEnabled = useFlag('module.workforce-employees');
  if (!workforceEnabled) return null;

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EmployeeRegistrationPageContent />
    </Suspense>
  );
}

function EmployeeRegistrationPageContent() {
  const t = useTranslations('Employees.registry');

  return (
    <main aria-label={t('pageTitle')} className="space-y-section-gap">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>
      <AnimateIn delay={1}>
        <EmployeeComplianceSection />
      </AnimateIn>
    </main>
  );
}
