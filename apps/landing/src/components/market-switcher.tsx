'use client';

import { Check, Globe } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/i18n';
import { localeConfigs, locales } from '@/i18n/config';
import type { Market } from '@/lib/market';
import { localeToMarket } from '@/lib/market';

const COOKIE_NAME = 'landing_market';
const COOKIE_MAX_AGE_DAYS = 180;

const MARKET_LABELS: Record<Market, string> = {
  PL: 'Polska — PLN',
  DE: 'Deutschland — EUR',
  INTL: 'International — EUR',
  UK: 'United Kingdom — GBP',
  UAE: 'United Arab Emirates — AED',
  SA: 'Saudi Arabia — SAR',
};

function setMarketCookie(market: Market) {
  if (typeof document === 'undefined') return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
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
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks Safari support; document.cookie is the portable fallback for a non-sensitive market preference.
  document.cookie = parts.join('; ');
}

export function MarketSwitcher() {
  const currentLocale = useLocale();
  const currentMarket = localeToMarket(currentLocale);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen(prev => !prev), []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  const handleSelect = useCallback((locale: (typeof locales)[number]) => {
    const market = localeToMarket(locale);
    setMarketCookie(market);
    // Static export → use full navigation so the new locale prefix renders.
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\/[^/]+/, '') || '/';
      window.location.href = `/${locale}${path}${window.location.search}${window.location.hash}`;
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose market"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-1/60 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted/40">
        <Globe className="h-3.5 w-3.5" aria-hidden />
        {MARKET_LABELS[currentMarket]}
      </button>
      {!!open && (
        <ul
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: combobox-style listbox built atop <ul>
          role="listbox"
          aria-label="Markets"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border/60 bg-surface-1/95 shadow-xl backdrop-blur-md z-50">
          {locales.map(locale => {
            const market = localeToMarket(locale);
            return (
              <li key={locale}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locale === currentLocale}
                  // biome-ignore lint/nursery/noJsxPropsBind: per-item handler closes over locale
                  onClick={() => handleSelect(locale)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">{MARKET_LABELS[market]}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {localeConfigs[locale].englishName}
                    </span>
                  </span>
                  {locale === currentLocale && (
                    <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
