/**
 * Translation message bundles.
 *
 * Sourced from the legacy app's `apps/web/messages/{locale}.json` files
 * by relative import so the original files remain the single source of
 * truth during the migration grace period. After Step 18 (legacy delete)
 * the messages are `git mv`d into `apps/web-vite/messages/` and the
 * import path here flips to './messages/{locale}.json' — single-line
 * change, no content drift.
 *
 * Locale JSON is loaded on demand via dynamic `import()` in
 * {@link loadLocaleMessages} so only the active locale (plus fallback)
 * ships in the initial bundle — not all four message files at once.
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
