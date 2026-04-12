import { SectionTracker } from "@/components/analytics/section-tracker";
import { CTA } from "@/components/cta";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { LogoBar } from "@/components/logo-bar";
import { Navbar } from "@/components/navbar";
import { Pricing } from "@/components/pricing";
import { Problem } from "@/components/problem";
import { SocialProof } from "@/components/social-proof";
import { StructuredData } from "@/components/structured-data";
import type { Locale } from "@/i18n";
import { defaultLocale, getTranslations, isValidLocale, TranslationProvider } from "@/i18n";
import type { PricingPlan } from "@/lib/stripe";
import { fetchPricingPlans } from "@/lib/stripe";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);

  let plans: PricingPlan[];
  try {
    plans = await fetchPricingPlans();
  } catch (error) {
    console.error("[landing] Failed to fetch pricing from Stripe:", error);
    const { PLAN_CONTENT } = await import("@/lib/pricing-content");
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
  }

  return (
    <TranslationProvider translations={t} locale={locale}>
      <StructuredData locale={locale} plans={plans} />
      <Navbar />
      <main>
        <SectionTracker name="hero">
          <Hero />
        </SectionTracker>
        <LogoBar />
        <div className="section-divider" />
        <SectionTracker name="problem">
          <Problem />
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
        <SectionTracker name="pricing">
          <Pricing plans={plans} />
        </SectionTracker>
        <SectionTracker name="cta">
          <CTA />
        </SectionTracker>
      </main>
      <Footer />
    </TranslationProvider>
  );
}
