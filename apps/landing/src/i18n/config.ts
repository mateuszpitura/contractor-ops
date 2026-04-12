export const defaultLocale = "en" as const;

export const locales = ["en", "pl", "de", "ar"] as const;

export type Locale = (typeof locales)[number];

export interface LocaleConfig {
  /** Display name in that language */
  name: string;
  /** Display name in English (for admin/dev) */
  englishName: string;
  /** Text direction */
  dir: "ltr" | "rtl";
  /** Currency for pricing display */
  currency: string;
  /** Intl locale string for number/date formatting */
  intlLocale: string;
  /** Additional Google Font for this locale (if needed) */
  font?: string;
  /** hreflang value */
  hreflang: string;
  /** Target market region */
  region: string;
}

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: {
    name: "English",
    englishName: "English",
    dir: "ltr",
    currency: "EUR",
    intlLocale: "en-GB",
    hreflang: "en",
    region: "EU",
  },
  pl: {
    name: "Polski",
    englishName: "Polish",
    dir: "ltr",
    currency: "PLN",
    intlLocale: "pl-PL",
    hreflang: "pl",
    region: "PL",
  },
  de: {
    name: "Deutsch",
    englishName: "German",
    dir: "ltr",
    currency: "EUR",
    intlLocale: "de-DE",
    hreflang: "de",
    region: "DACH",
  },
  ar: {
    name: "العربية",
    englishName: "Arabic",
    dir: "rtl",
    currency: "AED",
    intlLocale: "ar-AE",
    font: "Noto Sans Arabic",
    hreflang: "ar",
    region: "Gulf",
  },
};

export function isRtl(locale: Locale): boolean {
  return localeConfigs[locale].dir === "rtl";
}

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
