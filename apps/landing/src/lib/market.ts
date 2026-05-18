/**
 * Locale ↔ Market mapping for landing pages.
 *
 * Each locale maps to exactly one Market (the per-country pricing + ICP
 * scope). Locale defines language/direction/font; Market defines pricing,
 * compliance wedge, and analytics segmentation. Several locales can share
 * a market (e.g. ar + en-UAE → UAE), and a market always has a single
 * default locale used for outbound links.
 */
import type { Currency, Market } from '@contractor-ops/billing/types';
import { EU_MARKETS, GDPR_CONSENT_MARKETS, MARKET_CURRENCY } from '@contractor-ops/billing/types';
import type { Locale } from '@/i18n';
import { localeConfigs } from '@/i18n/config';

export type { Currency, Market };
export { EU_MARKETS, GDPR_CONSENT_MARKETS, MARKET_CURRENCY };

export const LOCALE_TO_MARKET: Record<Locale, Market> = {
  en: 'INTL',
  'en-GB': 'UK',
  pl: 'PL',
  de: 'DE',
  ar: 'UAE',
  'ar-SA': 'SA',
};

export const MARKET_TO_DEFAULT_LOCALE: Record<Market, Locale> = {
  INTL: 'en',
  PL: 'pl',
  DE: 'de',
  UK: 'en-GB',
  UAE: 'ar',
  SA: 'ar-SA',
};

export function localeToMarket(locale: Locale): Market {
  return LOCALE_TO_MARKET[locale];
}

export function marketToLocale(market: Market): Locale {
  return MARKET_TO_DEFAULT_LOCALE[market];
}

export function marketCurrency(market: Market): Currency {
  return MARKET_CURRENCY[market];
}

/**
 * True if the visitor's market is subject to EU/UK GDPR-equivalent cookie
 * consent (PL, DE, INTL fallback, UK). UAE + SA load analytics by default.
 */
export function requiresCookieConsent(market: Market): boolean {
  return GDPR_CONSENT_MARKETS.has(market);
}

export function isEuMarket(market: Market): boolean {
  return EU_MARKETS.has(market);
}

/**
 * BCP-47 Intl locale string used for number/date/currency formatting.
 * Derived from `localeConfigs[locale].intlLocale` so the locale config
 * remains the single source of truth for formatting conventions.
 */
export function intlLocaleFor(locale: Locale): string {
  return localeConfigs[locale].intlLocale;
}
