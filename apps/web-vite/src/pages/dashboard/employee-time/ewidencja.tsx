/**
 * Ewidencja czasu pracy — KP §149 immutable working-time register.
 *
 * Reached only when `module.workforce-employees` is enabled; the flag gate
 * removes the surface when OFF. All data access lives in the wired section's
 * hook. Auth gating lives on the shell parent in router.tsx.
 */

import { WORKBENCH_TABLE_PAGE_FILL_CLASS } from '@contractor-ops/ui';
import { Suspense } from 'react';
import { EwidencjaReport } from '../../../components/employee-time/ewidencja/ewidencja-report-section.js';
import { useFlag } from '../../../components/layout/feature-flag-context.js';
import { AnimateIn } from '../../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function EwidencjaPageContent() {
  const t = useTranslations('Ewidencja');
  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} description={t('archivedTooltip')} />
      </AnimateIn>
      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <EwidencjaReport />
      </AnimateIn>
    </div>
  );
}

export default function EwidencjaPage() {
  const workforceEnabled = useFlag('module.workforce-employees');
  if (!workforceEnabled) return null;

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EwidencjaPageContent />
    </Suspense>
  );
}
