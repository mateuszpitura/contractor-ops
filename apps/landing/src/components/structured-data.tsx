import type { Locale } from '@/i18n';
import { localeConfigs } from '@/i18n';
import type { PricingPlan } from '@/lib/stripe';

/**
 * JSON-LD structured data for SEO.
 * Renders Organization + SoftwareApplication + FAQ schema.
 */
export function StructuredData({
  locale,
  plans,
  faqItems,
}: {
  locale: Locale;
  plans?: PricingPlan[];
  faqItems?: { question: string; answer: string }[];
}) {
  const config = localeConfigs[locale];

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Contractor Ops',
    url: 'https://contractorops.com',
    logo: 'https://contractorops.com/logo.png',
    description:
      'B2B contractor management platform — contracts, invoices, approvals, payments in one system.',
    foundingDate: '2026',
    sameAs: [],
  };

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Contractor Ops',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: plans?.length
      ? plans
          .filter(p => p.monthlyPrice !== null)
          .map(plan => ({
            '@type': 'Offer',
            name: plan.name,
            price: plan.monthlyPrice === 0 ? '0' : String(plan.monthlyPrice),
            priceCurrency: config.currency,
            priceValidUntil: '2027-12-31',
            availability: 'https://schema.org/InStock',
          }))
      : undefined,
  };

  const faq = faqItems?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }
    : null;

  const schemas = [organization, software, faq].filter(Boolean);

  return (
    <>
      {schemas.map(schema => (
        <script
          key={(schema as Record<string, string>)['@type'] ?? JSON.stringify(schema).slice(0, 32)}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data from static schema objects
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
