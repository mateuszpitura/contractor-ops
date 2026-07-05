/**
 * Leave — staff/manager leave register, balances, and sick-absence recording.
 *
 * Reached only when `module.workforce-employees` is enabled; the flag gate
 * removes the surface from the render tree when OFF (no stub, no 404). All data
 * access lives in the wired section's hook. Auth gating lives on the shell
 * parent in router.tsx.
 */

import { WORKBENCH_TABLE_PAGE_FILL_CLASS } from '@contractor-ops/ui';
import { Suspense } from 'react';
import { useFlag } from '../../components/layout/feature-flag-context.js';
import { LeaveQueue } from '../../components/leave/leave-queue-section.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function LeavePageContent() {
  const t = useTranslations('Leave');
  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>
      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <LeaveQueue />
      </AnimateIn>
    </div>
  );
}

export default function LeavePage() {
  const workforceEnabled = useFlag('module.workforce-employees');
  if (!workforceEnabled) return null;

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <LeavePageContent />
    </Suspense>
  );
}
