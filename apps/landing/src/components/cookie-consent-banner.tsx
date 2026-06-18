'use client';

import { Cookie } from 'lucide-react';
import { useCallback, useLayoutEffect, useState } from 'react';
import { useLocale, useTranslations } from '@/i18n';
import type { ConsentState } from '@/lib/consent';
import { readConsent, subscribeConsent, writeConsent } from '@/lib/consent';
import { localeToMarket, requiresCookieConsent } from '@/lib/market';

interface BannerCopy {
  message: string;
  accept: string;
  reject: string;
  learnMore: string;
}

const FALLBACK: BannerCopy = {
  message:
    'We use cookies for anonymous analytics and to remember your preferences. Accept to enable full session analytics that help us improve the product.',
  accept: 'Accept all',
  reject: 'Essential only',
  learnMore: 'Read the privacy notice',
};

const FALLBACK_BY_LOCALE: Record<string, BannerCopy> = {
  pl: {
    message:
      'Używamy plików cookie do anonimowej analityki i zapamiętywania preferencji. Wybierz „Akceptuję wszystkie", aby włączyć pełną analitykę sesji.',
    accept: 'Akceptuj wszystkie',
    reject: 'Tylko niezbędne',
    learnMore: 'Polityka prywatności',
  },
  de: {
    message:
      'Wir verwenden Cookies für anonyme Analysen und um Präferenzen zu speichern. Mit „Alle akzeptieren" aktivieren Sie die vollständige Sitzungsanalyse.',
    accept: 'Alle akzeptieren',
    reject: 'Nur erforderliche',
    learnMore: 'Datenschutz',
  },
  'en-GB': {
    message:
      'We use cookies for anonymous analytics and to remember preferences. Accept to enable full session analytics that help us improve the product.',
    accept: 'Accept all',
    reject: 'Essential only',
    learnMore: 'Privacy notice',
  },
};

function readCopy(locale: string, translations: unknown): BannerCopy {
  const t = translations as { pricing?: unknown } & {
    cookieConsent?: Partial<BannerCopy>;
  };
  const fallback = FALLBACK_BY_LOCALE[locale] ?? FALLBACK;
  return {
    message: t.cookieConsent?.message ?? fallback.message,
    accept: t.cookieConsent?.accept ?? fallback.accept,
    reject: t.cookieConsent?.reject ?? fallback.reject,
    learnMore: t.cookieConsent?.learnMore ?? fallback.learnMore,
  };
}

export function CookieConsentBanner() {
  const locale = useLocale();
  const translations = useTranslations();
  const market = localeToMarket(locale);
  const [consentReady, setConsentReady] = useState(false);
  const [state, setState] = useState<ConsentState>('unknown');

  useLayoutEffect(() => {
    setState(readConsent());
    setConsentReady(true);
    return subscribeConsent(setState);
  }, []);

  const handleAccept = useCallback(() => {
    writeConsent('accepted');
  }, []);

  const handleReject = useCallback(() => {
    writeConsent('rejected');
  }, []);

  // Markets outside the GDPR-equivalent set (UAE / SA) load analytics by
  // default per local norms; never show the banner there.
  if (!requiresCookieConsent(market)) return null;
  // Wait until localStorage is read — avoids a flash while state is still 'unknown'.
  if (!consentReady) return null;
  if (state !== 'unknown') return null;

  const copy = readCopy(locale, translations);

  return (
    <section aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 rounded-2xl border border-border bg-background/95 p-5 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:gap-4">
        <Cookie className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
        <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
          {copy.message}{' '}
          <a
            href={`/${locale}/legal/privacy`}
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            {copy.learnMore}
          </a>
        </p>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <button
            type="button"
            onClick={handleReject}
            className="flex-1 rounded-xl border border-border bg-surface-1 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 sm:flex-none">
            {copy.reject}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 sm:flex-none">
            {copy.accept}
          </button>
        </div>
      </div>
    </section>
  );
}
