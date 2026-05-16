'use client';

import { AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { Calculator, FileBadge, Percent } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PinActionButton } from '@/components/settings/pin-action-button';
import { CountryRatesSection } from '@/components/settings/tax/country-rates-section';
import { WhtCalculatorSection } from '@/components/settings/tax/wht-calculator-section';
import { WhtCertificatesSection } from '@/components/settings/tax/wht-certificates-section';
import { AnimateIn } from '@/components/shared/animate-in';
import { usePermissions } from '@/hooks/use-permissions';

/**
 * Tax admin settings sub-page.
 *
 * Hosts three sub-sections, each backed by procedures on `tax.*`:
 *   1. Country rates browser + inline VAT-code validation.
 *   2. Cross-border WHT calculator.
 *   3. Issued WHT certificates with View + Download.
 *
 * Visibility is gated on `can('settings', ['read'])` — read-only viewers
 * (the `readonly` role) do not have settings read perms and therefore can
 * neither see the tab in the parent settings page nor reach this route
 * directly.
 */
export default function TaxSettingsPage() {
  const t = useTranslations('TaxAdmin');
  const { can, isLoading } = usePermissions();

  // Hide the page entirely from viewers who can't read settings.
  // While the session is loading we let the page render — `can()` returns
  // false until the role lands, so the skeleton path is naturally safe.
  if (!(isLoading || can('settings', ['read']))) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader
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
