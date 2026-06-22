/**
 * Employees — flag-dark skeleton route reached only when
 * `module.workforce-employees` is enabled. The employee registry, personnel
 * files, and data wiring land in the workforce phase; this shell holds the
 * route and renders an accessible "not yet available" state so the gated
 * dashboard link never resolves to a 404.
 */

import { ContractorsIllustration } from '@contractor-ops/ui';
import { Suspense } from 'react';

import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function EmployeesPageContent() {
  const t = useTranslations('Employees');

  return (
    <main aria-label={t('title')} className="space-y-section-gap">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('title')} description={t('pageDescription')} />
      </AnimateIn>
      <AnimateIn delay={1}>
        <div className="dot-grid corner-marks flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-border/40 text-center">
          <div className="flex flex-col items-center px-6 py-16">
            <ContractorsIllustration className="h-28 w-28" />
            <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
              {t('comingSoon.heading')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('comingSoon.body')}</p>
          </div>
        </div>
      </AnimateIn>
    </main>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EmployeesPageContent />
    </Suspense>
  );
}
