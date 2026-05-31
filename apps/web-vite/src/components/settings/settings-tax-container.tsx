import { SectionLabel } from '@contractor-ops/ui';
import { Calculator, FileBadge, Percent } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { useSettingsTax } from './hooks/use-settings-tax.js';
import { PinActionButton } from './pin-action-button.js';
import { CountryRatesSectionContainer } from './tax/country-rates-section-container.js';
import { WhtCalculatorSectionContainer } from './tax/wht-calculator-section-container.js';
import { WhtCertificatesSectionContainer } from './tax/wht-certificates-section-container.js';

export function SettingsTaxContainer() {
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
          <CountryRatesSectionContainer />
        </section>
      </AnimateIn>

      <AnimateIn delay={2}>
        <section aria-label={t('sections.calculator')} className="space-y-3">
          <SectionLabel icon={Calculator}>{t('sections.calculator')}</SectionLabel>
          <WhtCalculatorSectionContainer />
        </section>
      </AnimateIn>

      <AnimateIn delay={3}>
        <section aria-label={t('sections.certificates')} className="space-y-3">
          <SectionLabel icon={FileBadge}>{t('sections.certificates')}</SectionLabel>
          <WhtCertificatesSectionContainer />
        </section>
      </AnimateIn>
    </div>
  );
}
