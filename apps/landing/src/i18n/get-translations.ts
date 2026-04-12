import type { Locale } from "./config";

/**
 * Load translations for a given locale.
 * Uses dynamic import so only the needed locale JSON is bundled per page.
 */
export async function getTranslations(locale: Locale) {
  const translations = await import(`./locales/${locale}.json`);
  return translations.default as TranslationMessages;
}

/**
 * Flat namespace structure for type-safe translations.
 * Nested under section keys for organization.
 */
export interface TranslationMessages {
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
  };
  nav: {
    features: string;
    howItWorks: string;
    pricing: string;
    login: string;
    getStarted: string;
  };
  hero: {
    badge: string;
    headline: string;
    headlineHighlight: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    metricSaved: string;
    metricAccuracy: string;
    metricOnboarding: string;
  };
  logoBar: {
    title: string;
  };
  problem: {
    label: string;
    headline: string;
    headlineHighlight: string;
    description: string;
    tools: {
      excel: string;
      email: string;
      slack: string;
      drive: string;
      bank: string;
      nowhere: string;
    };
    pains: {
      excel: string;
      email: string;
      slack: string;
      drive: string;
      bank: string;
      nowhere: string;
    };
  };
  features: {
    label: string;
    headline: string;
    headlineHighlight: string;
    description: string;
    items: {
      contracts: { title: string; description: string };
      onboarding: { title: string; description: string };
      invoices: { title: string; description: string };
      approvals: { title: string; description: string };
      payments: { title: string; description: string };
      offboarding: { title: string; description: string };
      compliance: { title: string; description: string };
      analytics: { title: string; description: string };
    };
  };
  howItWorks: {
    label: string;
    headline: string;
    headlineHighlight: string;
    description: string;
    steps: {
      onboard: { title: string; description: string };
      contract: { title: string; description: string };
      invoice: { title: string; description: string };
      approve: { title: string; description: string };
      pay: { title: string; description: string };
    };
  };
  socialProof: {
    label: string;
    headline: string;
    headlineHighlight: string;
    stats: {
      processing: { value: string; label: string };
      auditTrail: { value: string; label: string };
      approvalTime: { value: string; label: string };
      offboarding: { value: string; label: string };
    };
  };
  pricing: {
    label: string;
    headline: string;
    headlineHighlight: string;
    description: string;
    perContractor: string;
    upTo5: string;
    startFree: string;
    startTrial: string;
    talkToSales: string;
    detailedLink: string;
  };
  cta: {
    headline: string;
    headlineHighlight: string;
    description: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trust: string;
  };
  footer: {
    description: string;
    product: string;
    company: string;
    legal: string;
    copyright: string;
    madeIn: string;
  };
}
