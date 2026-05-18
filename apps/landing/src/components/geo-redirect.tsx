'use client';

import { useEffect } from 'react';
import { locales } from '@/i18n/config';
import type { Market } from '@/lib/market';
import { marketToLocale } from '@/lib/market';

const COOKIE_NAME = 'landing_market';
const GEO_LOOKUP_URL = 'https://ipapi.co/country/';

function readMarketCookie(): Market | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)landing_market=([^;]+)/);
  if (!match) return null;
  const value = match[1] as Market;
  return (['PL', 'DE', 'INTL', 'UK', 'UAE', 'SA'] as readonly Market[]).includes(value)
    ? value
    : null;
}

function writeMarketCookie(market: Market) {
  const maxAge = 180 * 24 * 60 * 60;
  const domain =
    typeof window !== 'undefined' && window.location.hostname.endsWith('contractor-ops.com')
      ? '.contractor-ops.com'
      : undefined;
  const parts = [
    `${COOKIE_NAME}=${market}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
    'Secure',
  ];
  if (domain) parts.push(`Domain=${domain}`);
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks Safari support; document.cookie is the portable fallback.
  document.cookie = parts.join('; ');
}

function pickMarketFromLanguage(languages: readonly string[]): Market | null {
  for (const raw of languages) {
    const tag = raw.toLowerCase();
    if (tag.startsWith('pl')) return 'PL';
    if (tag.startsWith('de')) return 'DE';
    if (tag === 'en-gb' || tag === 'en-uk') return 'UK';
    if (tag.startsWith('en')) return 'INTL';
    if (tag === 'ar-sa') return 'SA';
    if (tag.startsWith('ar')) return 'UAE';
  }
  return null;
}

function marketFromCountry(country: string): Market {
  const cc = country.toUpperCase();
  if (cc === 'PL') return 'PL';
  if (cc === 'DE' || cc === 'AT' || cc === 'CH') return 'DE';
  if (cc === 'GB' || cc === 'UK' || cc === 'IE') return 'UK';
  if (cc === 'AE') return 'UAE';
  if (cc === 'SA') return 'SA';
  return 'INTL';
}

async function detectMarket(): Promise<Market> {
  const cookie = readMarketCookie();
  if (cookie) return cookie;

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const fromLang = pickMarketFromLanguage(languages);
  if (fromLang) return fromLang;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(GEO_LOOKUP_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      const country = (await response.text()).trim();
      if (country.length >= 2) return marketFromCountry(country);
    }
  } catch {
    // Geo lookup is best-effort — INTL fallback is acceptable.
  }
  return 'INTL';
}

/**
 * Client-side market detection + redirect that runs on the bare-root URL.
 *
 * The landing app builds with `output: 'export'` (static), so middleware is
 * unavailable. This component runs after hydration on `/`, detects the
 * preferred market (cookie → Accept-Language → IP geo → INTL fallback),
 * persists the choice in a cookie scoped to `.contractor-ops.com`, and
 * redirects to `/<locale>`. Subsequent visits short-circuit on the cookie.
 */
export function GeoRedirect({ fallbackLocale }: { fallbackLocale: string }) {
  useEffect(() => {
    let cancelled = false;
    detectMarket()
      .then(market => {
        if (cancelled) return;
        writeMarketCookie(market);
        const target = marketToLocale(market);
        const safeLocale = (locales as readonly string[]).includes(target)
          ? target
          : fallbackLocale;
        window.location.replace(`/${safeLocale}${window.location.search}${window.location.hash}`);
      })
      .catch(() => {
        if (!cancelled) window.location.replace(`/${fallbackLocale}`);
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackLocale]);

  return null;
}
