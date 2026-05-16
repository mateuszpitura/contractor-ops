import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LocaleHtmlAttributes } from '@/components/locale-html-attributes';
import { defaultLocale, getTranslations, isValidLocale, localeConfigs, locales } from '@/i18n';

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = isValidLocale(localeParam) ? localeParam : defaultLocale;
  const t = await getTranslations(locale);
  const config = localeConfigs[locale];

  const baseUrl = 'https://contractorops.com';

  return {
    title: t.meta.title,
    description: t.meta.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      type: 'website',
      locale: config.intlLocale,
      url: `${baseUrl}/${locale}`,
      siteName: 'Contractor Ops',
      images: [
        {
          url: `${baseUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: 'Contractor Ops — B2B Contractor Management',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      images: [`${baseUrl}/og-image.png`],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(
        locales.map(l => [localeConfigs[l].hreflang, `${baseUrl}/${l}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;

  if (!isValidLocale(localeParam)) {
    notFound();
  }

  const config = localeConfigs[localeParam];

  // Phase C.1.a (production-hardening): lang/dir/font for the locale are
  // applied via a client-only effect (no inline <script>). The root layout
  // renders `<html lang="en" dir="ltr">` by default; this component swaps
  // those attributes once React hydrates. SEO crawlers still receive correct
  // per-locale metadata via `generateMetadata` above (hreflang, og:locale).
  return (
    <>
      <LocaleHtmlAttributes lang={localeParam} dir={config.dir} isArabic={localeParam === 'ar'} />
      {children}
    </>
  );
}
