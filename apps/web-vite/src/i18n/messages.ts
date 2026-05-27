/**
 * Translation message bundles, loaded on demand via dynamic `import()` in
 * {@link loadLocaleMessages} so only the active locale (plus fallback)
 * ships in the initial bundle. Source: `apps/web-vite/messages/{locale}.json`.
 */

import type en from '../../messages/en.json';

export const SUPPORTED_LOCALES = ['en', 'pl', 'ar', 'de'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pl';

/** Message bundle shape — used by settings tab i18n key typing. */
export type Messages = typeof en;

export interface LocaleMeta {
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
}

export const localeMeta: Record<Locale, LocaleMeta> = {
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr' },
  pl: { nativeName: 'Polski', englishName: 'Polish', dir: 'ltr' },
  ar: { nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  de: { nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
};

export function isSupportedLocale(value: string | undefined): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the best-matching supported locale for a browser-language tag
 * preference list. Each entry is normalised to its 2-letter language part
 * (`en-US` → `en`), then matched against `SUPPORTED_LOCALES` in order.
 * Falls back to `DEFAULT_LOCALE` when nothing matches.
 */
export function pickBestLocale(preferences: readonly string[]): Locale {
  for (const raw of preferences) {
    const tag = raw.split(/[-_]/)[0]?.toLowerCase();
    if (tag && isSupportedLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/**
 * Browser-side wrapper around `pickBestLocale` that reads
 * `navigator.languages` (with `navigator.language` as a fallback) so the
 * unlocalized root route lands the user on their preferred locale.
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const prefs =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
  return pickBestLocale(prefs);
}

const localeLoaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('../../messages/en.json'),
  pl: () => import('../../messages/pl.json'),
  ar: () => import('../../messages/ar.json'),
  de: () => import('../../messages/de.json'),
};

const loadedMessages = new Map<Locale, Record<string, unknown>>();

/** Fetch (and cache) the message bundle for a locale. */
export async function loadLocaleMessages(locale: Locale): Promise<Record<string, unknown>> {
  const cached = loadedMessages.get(locale);
  if (cached) return cached;

  const mod = await localeLoaders[locale]();
  loadedMessages.set(locale, mod.default);
  return mod.default;
}
