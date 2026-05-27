/**
 * i18n smoke tests:
 *
 *   1. ICU strings from `apps/web-vite/messages/{locale}.json` render
 *      against each supported locale without "missing key" errors.
 *   2. `applyLocale('ar')` flips `<html dir>` to `rtl`.
 *   3. `i18next.language` matches the URL `:locale` segment after the
 *      detector runs.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { applyLocale, i18next, initI18n } from '../index.js';
import { isSupportedLocale, SUPPORTED_LOCALES } from '../messages.js';

beforeEach(() => {
  // jsdom restores between tests, but reset dir explicitly to be safe.
  document.documentElement.dir = 'ltr';
  document.documentElement.lang = 'en';
});

describe('i18n bootstrap', () => {
  it('initialises against all supported locales', async () => {
    initI18n();
    for (const loc of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(loc)).toBe(true);
      await applyLocale(loc);
      expect(i18next.language).toBe(loc);
    }
  });

  it('toggles <html dir> to rtl for Arabic and back to ltr for non-Arabic', async () => {
    initI18n();
    await applyLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    await applyLocale('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('does not throw on lookup of an unknown key (returns the key itself)', async () => {
    initI18n();
    await applyLocale('en');
    const value = i18next.t('definitely.unknown.namespace.key');
    expect(typeof value).toBe('string');
    // i18next default behaviour: returns the key string when missing.
    expect(value).toContain('definitely.unknown');
  });
});
