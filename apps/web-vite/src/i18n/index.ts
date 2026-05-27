/**
 * i18next bootstrap with ICU formatter — the SPA equivalent of the
 * legacy next-intl init.
 *
 * Message bundles are loaded on demand via {@link loadLocaleMessages} and
 * registered per locale by {@link applyLocale}. i18next-icu is wired so
 * the existing ICU MessageFormat strings in apps/web/messages/{locale}.json
 * keep working unchanged (plural forms, date/number format, selectordinal, ...).
 *
 * Language detection priority (highest first):
 *   1. URL `:locale` path segment — the SPA's source of truth.
 *   2. Persistent cookie — sticky preference across visits.
 *   3. navigator.language — first-visit best guess.
 *
 * The path detector is implemented inline rather than via
 * i18next-browser-languagedetector's built-in `path` order because that
 * detector indexes URL segments globally; React Router strips its base
 * before our hook runs, so a custom detector reading the first segment
 * of `window.location.pathname` is more reliable.
 */

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import type { Locale } from './messages.js';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  loadLocaleMessages,
  SUPPORTED_LOCALES,
} from './messages.js';

const urlPathDetector = {
  name: 'urlPath',
  lookup(): string | undefined {
    if (typeof window === 'undefined') return;
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    return isSupportedLocale(first) ? first : undefined;
  },
  cacheUserLanguage(): void {
    // no-op: the URL is its own cache.
  },
};

let bootstrapped = false;

async function registerLocaleBundle(locale: Locale): Promise<void> {
  const bundle = await loadLocaleMessages(locale);
  i18next.addResourceBundle(locale, 'translation', bundle, true, true);
}

/**
 * Wrap the `console` methods i18next reaches for so the unconditional Locize
 * promo banner ("🌐 i18next is made possible by our own product, Locize…")
 * never reaches DevTools. i18next has no opt-out in its public API and
 * has shipped the banner via different methods across versions (`log`
 * in v23, `info` in v24+). Wrapping both covers either path. The wrapper
 * is removed once init resolves so it adds zero runtime overhead after.
 */
function silenceLocizeBanner(): () => void {
  const methods = ['log', 'info'] as const;
  // biome-ignore lint/suspicious/noConsole: deliberately wraps `console.log`/`info` to strip i18next's Locize promo banner; originals are restored once init resolves
  const originals: Partial<Record<(typeof methods)[number], typeof console.log>> = {};
  for (const m of methods) {
    // biome-ignore lint/suspicious/noConsole: see silenceLocizeBanner header
    originals[m] = console[m];
    // biome-ignore lint/suspicious/noConsole: see silenceLocizeBanner header
    console[m] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('i18next is made possible')) return;
      originals[m]?.apply(console, args);
    };
  }
  return () => {
    for (const m of methods) {
      // biome-ignore lint/suspicious/noConsole: see silenceLocizeBanner header
      if (originals[m]) console[m] = originals[m]!;
    }
  };
}

export function initI18n(): typeof i18next {
  if (bootstrapped) return i18next;

  const detector = new LanguageDetector();
  detector.addDetector(urlPathDetector);

  const restoreConsoleLog = silenceLocizeBanner();
  const initPromise = i18next
    .use(ICU)
    .use(detector)
    .use(initReactI18next)
    .init({
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as readonly string[],
      // Bundles are added on demand — not all locales ship in the initial JS.
      partialBundledLanguages: true,
      // `defaultNS` keeps `useTranslation('namespace.path')` matching the
      // legacy `useTranslations('namespace.path')` shape — both treat the
      // first arg as a sub-namespace within a single flat resource bundle.
      ns: 'translation',
      defaultNS: 'translation',
      interpolation: {
        // i18next-icu owns interpolation; disable i18next's own to avoid
        // double-processing curly braces inside ICU MessageFormat strings.
        escapeValue: false,
      },
      detection: {
        order: ['urlPath', 'cookie', 'navigator'],
        caches: ['cookie'],
        cookieMinutes: 60 * 24 * 365,
        cookieDomain: typeof window === 'undefined' ? undefined : window.location.hostname,
      },
      returnNull: false,
    });
  initPromise.finally(restoreConsoleLog);

  bootstrapped = true;
  return i18next;
}

/**
 * Switch i18next's active language AND flip `<html lang>` + `<html dir>`.
 * Called by the React Router locale loader on every navigation that
 * changes the `:locale` segment.
 */
export async function applyLocale(locale: Locale): Promise<void> {
  if (!bootstrapped) initI18n();

  await registerLocaleBundle(locale);
  if (locale !== DEFAULT_LOCALE) {
    await registerLocaleBundle(DEFAULT_LOCALE);
  }

  if (i18next.language !== locale) {
    await i18next.changeLanguage(locale);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }
}

export { i18next };
