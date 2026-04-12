import { SectionTracker } from "@/components/analytics/section-tracker";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { CreditsSection } from "@/components/pricing/credits-section";
import { FeatureComparison } from "@/components/pricing/feature-comparison";
import { PricingFAQ } from "@/components/pricing/pricing-faq";
import { PricingHero } from "@/components/pricing/pricing-hero";
import type { Locale } from "@/i18n";
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from "@/i18n";
import type { CreditPack, PricingPlan } from "@/lib/stripe";
import { fetchCreditPacks, fetchPricingPlans } from "@/lib/stripe";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  let plans: PricingPlan[];
  let creditPacks: CreditPack[];
  try {
    [plans, creditPacks] = await Promise.all([fetchPricingPlans(), fetchCreditPacks()]);
  } catch (error) {
    console.error("[pricing] Failed to fetch from Stripe:", error);
    const { PLAN_CONTENT, CREDIT_PACK_CONTENT } = await import("@/lib/pricing-content");
    plans = Object.entries(PLAN_CONTENT).map(([slug, c]) => ({
      id: slug,
      name: c.name,
      description: c.description,
      features: c.features,
      monthlyPrice: c.fallbackMonthlyPrice,
      annualPrice: c.fallbackAnnualPrice,
      currency: "pln",
      ctaHref: `/signup?plan=${slug}`,
      popular: c.popular,
      order: c.order,
    }));
    creditPacks = Object.entries(CREDIT_PACK_CONTENT).map(([slug, c]) => ({
      id: slug,
      name: c.name,
      description: c.description,
      credits: c.fallbackCredits,
      price: c.fallbackPrice,
      currency: "pln",
      perCredit:
        c.fallbackCredits > 0 ? Math.round((c.fallbackPrice / c.fallbackCredits) * 100) / 100 : 0,
      ctaHref: `/signup?credits=${slug}`,
      popular: c.popular,
      order: c.order,
    }));
  }

  return (
    <TranslationProvider translations={t} locale={locale}>
      <Navbar />
      <main>
        <SectionTracker name="pricing-hero">
          <PricingHero plans={plans} />
        </SectionTracker>
        <div className="section-divider" />
        <SectionTracker name="feature-comparison">
          <FeatureComparison />
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
