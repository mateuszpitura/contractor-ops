import { SectionLabel } from '@contractor-ops/ui';
import { Calculator, FileBadge, Percent } from 'lucide-react';
import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import { useSettingsTax } from '../../../components/settings/hooks/use-settings-tax.js';
import { PinActionButton } from '../../../components/settings/pin-action-button.js';
import { CountryRatesSection } from '../../../components/settings/tax/country-rates-section.js';
import { WhtCalculatorSection } from '../../../components/settings/tax/wht-calculator-section.js';
import { WhtCertificatesSection } from '../../../components/settings/tax/wht-certificates-section.js';
import { AnimateIn } from '../../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function TaxSettingsContent() {
  const t = useTranslations('TaxAdmin');
  const { canView, unauthorizedHref } = useSettingsTax();

  if (!canView) {
    return <Navigate to={unauthorizedHref} replace />;
  }

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          description={t('subtitle')}
          actions={<PinActionButton tabKey="tax" />}
        />
      </AnimateIn>

      <AnimateIn delay={1}>
        <section aria-label={t('sections.rates')} className="space-y-3">
          <SectionLabel icon={Percent}>{t('sections.rates')}</SectionLabel>
          <CountryRatesSection />
        </section>
      </AnimateIn>

      <AnimateIn delay={2}>
        <section aria-label={t('sections.calculator')} className="space-y-3">
          <SectionLabel icon={Calculator}>{t('sections.calculator')}</SectionLabel>
          <WhtCalculatorSection />
        </section>
      </AnimateIn>

      <AnimateIn delay={3}>
        <section aria-label={t('sections.certificates')} className="space-y-3">
          <SectionLabel icon={FileBadge}>{t('sections.certificates')}</SectionLabel>
          <WhtCertificatesSection />
        </section>
      </AnimateIn>
    </div>
  );
}

export default function TaxSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <TaxSettingsContent />
    </Suspense>
  );
}
