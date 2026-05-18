export const defaultLocale = 'en' as const;

/**
 * Supported landing locales — one entry per market on launch.
 *
 *   en     → INTL fallback (English, EUR-priced)
 *   en-GB  → UK (English, GBP-priced)
 *   pl     → PL (Polish)
 *   de     → DE (German)
 *   ar     → UAE (Arabic primary)
 *   ar-SA  → SA (Arabic, KSA copy + SAR pricing)
 *
 * Locale ↔ Market mapping is centralised in `@/lib/market`.
 */
export const locales = ['en', 'en-GB', 'pl', 'de', 'ar', 'ar-SA'] as const;

export type Locale = (typeof locales)[number];

export interface LocaleConfig {
  /** Display name in that language */
  name: string;
  /** Display name in English (for admin/dev) */
  englishName: string;
  /** Text direction */
  dir: 'ltr' | 'rtl';
  /** Currency for pricing display — derived from market; kept for legacy callers. */
  currency: string;
  /** Intl locale string for number/date formatting */
  intlLocale: string;
  /** Additional Google Font for this locale (if needed) */
  font?: string;
  /** hreflang value */
  hreflang: string;
  /** Target market region label (display only — market enum lives in market.ts). */
  region: string;
}

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: {
    name: 'English',
    englishName: 'English (international)',
    dir: 'ltr',
    currency: 'EUR',
    intlLocale: 'en-GB',
    hreflang: 'en',
    region: 'INTL',
  },
  'en-GB': {
    name: 'English (UK)',
    englishName: 'English (UK)',
    dir: 'ltr',
    currency: 'GBP',
    intlLocale: 'en-GB',
    hreflang: 'en-GB',
    region: 'UK',
  },
  pl: {
    name: 'Polski',
    englishName: 'Polish',
    dir: 'ltr',
    currency: 'PLN',
    intlLocale: 'pl-PL',
    hreflang: 'pl',
    region: 'PL',
  },
  de: {
    name: 'Deutsch',
    englishName: 'German',
    dir: 'ltr',
    currency: 'EUR',
    intlLocale: 'de-DE',
    hreflang: 'de',
    region: 'DACH',
  },
  ar: {
    name: 'العربية (الإمارات)',
    englishName: 'Arabic (UAE)',
    dir: 'rtl',
    currency: 'AED',
    intlLocale: 'ar-AE',
    font: 'Noto Sans Arabic',
    hreflang: 'ar-AE',
    region: 'UAE',
  },
  'ar-SA': {
    name: 'العربية (السعودية)',
    englishName: 'Arabic (KSA)',
    dir: 'rtl',
    currency: 'SAR',
    intlLocale: 'ar-SA',
    font: 'Noto Sans Arabic',
    hreflang: 'ar-SA',
    region: 'SA',
  },
};

export function isRtl(locale: Locale): boolean {
  return localeConfigs[locale].dir === 'rtl';
}

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
