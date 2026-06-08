/**
 * Translation message bundles, loaded on demand via dynamic `import()` in
 * {@link loadLocaleMessages} so only the active locale (plus fallback)
 * ships in the initial bundle. Source: `apps/web-vite/messages/{locale}.json`.
 */

import type en from '../../messages/en.json';

export const SUPPORTED_LOCALES = ['en', 'pl', 'ar', 'de', 'en-US'] as const;
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
  'en-US': { nativeName: 'English (US)', englishName: 'English (US)', dir: 'ltr' },
};

export function isSupportedLocale(value: string | undefined): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the best-matching supported locale for a browser-language tag
 * preference list. An exact (case-insensitive) match against a region-qualified
 * supported locale wins first (`en-US` → `en-US`); otherwise each entry is
 * normalised to its 2-letter language part (`en-GB` → `en`) and matched against
 * `SUPPORTED_LOCALES` in order. Falls back to `DEFAULT_LOCALE` when nothing
 * matches. The exact-match pass keeps an explicit `en-US` choice from collapsing
 * to `en`, so US users land on the en-US override instead of the en base.
 */
export function pickBestLocale(preferences: readonly string[]): Locale {
  const exactByLower = new Map(
    (SUPPORTED_LOCALES as readonly string[]).map(loc => [loc.toLowerCase(), loc as Locale]),
  );
  for (const raw of preferences) {
    const exact = exactByLower.get(raw.toLowerCase());
    if (exact) return exact;
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
  // Thin override: only divergent keys (US spelling / copy). Every unchanged key
  // is inherited from `en` at runtime via the i18next fallbackLng chain.
  'en-US': () => import('../../messages/en-US.json'),
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
