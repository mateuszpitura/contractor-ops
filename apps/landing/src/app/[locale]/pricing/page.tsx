import { createLogger } from '@contractor-ops/logger';
import { SectionTracker } from '@/components/analytics/section-tracker';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { CreditsSection } from '@/components/pricing/credits-section';
import { FeatureComparison } from '@/components/pricing/feature-comparison';
import { PricingFAQ } from '@/components/pricing/pricing-faq';
import { PricingHero } from '@/components/pricing/pricing-hero';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import { annualSavingsPercent, buildLandingPlanViews } from '@/lib/landing-plan-view';
import { localeToMarket } from '@/lib/market';
import type { CreditPack, PricingPlan } from '@/lib/pricing-types';
import { fetchCreditPacks, fetchPricingPlans } from '@/lib/stripe';

const log = createLogger({ service: 'landing-pricing-page' });

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const market = localeToMarket(locale);
  const t = await getTranslations(locale);

  let plans: PricingPlan[] = [];
  let creditPacks: CreditPack[] = [];
  try {
    [plans, creditPacks] = await Promise.all([fetchPricingPlans(market), fetchCreditPacks()]);
  } catch (error) {
    log.error({ err: error, market }, 'failed to fetch pricing from Stripe');
  }

  const views = buildLandingPlanViews(plans, t, locale);
  const annualSavings = annualSavingsPercent(plans);

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main>
        <SectionTracker name="pricing-hero">
          <PricingHero views={views} annualSavings={annualSavings} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="feature-comparison">
          <FeatureComparison views={views} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="credits">
          <CreditsSection creditPacks={creditPacks} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="pricing-faq">
          <PricingFAQ />
        </SectionTracker>
      </main>
      <Footer />
    </TranslationProvider>
  );
}
