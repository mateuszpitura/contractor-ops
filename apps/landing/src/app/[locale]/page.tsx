import { createLogger } from '@contractor-ops/logger';
import { SectionTracker } from '@/components/analytics/section-tracker';
import { CTA } from '@/components/cta';
import { Features } from '@/components/features';
import { Footer } from '@/components/footer';
import { Hero } from '@/components/hero';
import { HowItWorks } from '@/components/how-it-works';
import { Navbar } from '@/components/navbar';
import { Pricing } from '@/components/pricing';
import { Problem } from '@/components/problem';
import {
  BentoFeatures,
  CtaBand,
  FaqSection,
  IntegrationsGrid,
  LogoMarquee,
  StatsBand,
  Testimonials,
} from '@/components/sections';
import { SocialProof } from '@/components/social-proof';
import { StructuredData } from '@/components/structured-data';
import type { Locale } from '@/i18n';
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from '@/i18n';
import type { PricingPlan } from '@/lib/pricing-types';
import { formatPrice } from '@/lib/pricing-types';
import { fetchPricingPlans } from '@/lib/stripe';

const log = createLogger({ service: 'landing-home-page' });

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  let plans: PricingPlan[];
  try {
    plans = await fetchPricingPlans();
  } catch (error) {
    log.error({ err: error }, 'failed to fetch pricing from Stripe');
    const { PLAN_CONTENT } = await import('@/lib/pricing-content');
    plans = Object.entries(PLAN_CONTENT).map(([slug, c]) => ({
      id: slug,
      name: c.name,
      description: c.description,
      features: c.features,
      monthlyPrice: c.fallbackMonthlyPrice,
      annualPrice: c.fallbackAnnualPrice,
      currency: 'pln',
      ctaHref: `/signup?plan=${slug}`,
      popular: c.popular,
      order: c.order,
      monthlyPriceFormatted: formatPrice(c.fallbackMonthlyPrice, 'pln'),
      annualPriceFormatted: formatPrice(c.fallbackAnnualPrice, 'pln'),
    }));
  }

  return (
    <TranslationProvider translations={t} locale={locale}>
      <StructuredData locale={locale} plans={plans} />
      <Navbar />
      <main>
        <SectionTracker name="hero">
          <Hero />
        </SectionTracker>
        <SectionTracker name="logo-marquee">
          <LogoMarquee title={t.logoBar.title} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="problem">
          <Problem />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="stats-band">
          <StatsBand label={t.statsBand.label} items={t.statsBand.items} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="bento">
          <BentoFeatures
            label={t.bento.label}
            headline={t.bento.headline}
            headlineHighlight={t.bento.headlineHighlight}
            description={t.bento.description}
            cards={t.bento.cards}
          />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="social-proof">
          <SocialProof />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="features">
          <Features />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="how-it-works">
          <HowItWorks />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="integrations">
          <IntegrationsGrid
            label={t.integrationsGrid.label}
            headline={t.integrationsGrid.headline}
            headlineHighlight={t.integrationsGrid.headlineHighlight}
            description={t.integrationsGrid.description}
            items={t.integrationsGrid.items}
          />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="testimonials">
          <Testimonials
            label={t.testimonials.label}
            headline={t.testimonials.headline}
            headlineHighlight={t.testimonials.headlineHighlight}
            description={t.testimonials.description}
            items={t.testimonials.items}
          />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="pricing">
          <Pricing plans={plans} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="faq">
          <FaqSection
            label={t.faq.label}
            headline={t.faq.headline}
            headlineHighlight={t.faq.headlineHighlight}
            description={t.faq.description}
            items={t.faq.items}
          />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="cta">
          <CTA />
        </SectionTracker>
        <SectionTracker name="cta-band">
          <CtaBand
            label={t.ctaBand.label}
            headline={t.ctaBand.headline}
            headlineHighlight={t.ctaBand.headlineHighlight}
            description={t.ctaBand.description}
            ctaPrimary={t.ctaBand.ctaPrimary}
            ctaSecondary={t.ctaBand.ctaSecondary}
          />
        </SectionTracker>
      </main>
      <Footer />
    </TranslationProvider>
  );
}
