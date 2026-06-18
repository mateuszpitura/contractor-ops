import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ApiErrors from '../errors';

/**
 * Every string exported from errors.ts that looks like an API error code must
 * exist under `Errors` in all four shipped locales (en, pl, de, ar) and every
 * `Errors.*` string entry in en.json must back to an exported errors.ts value
 * (or be one of the allowed non-code helpers like `generic`). This locks the
 * client-side translation contract for the entire goal milestone.
 */

type LocaleBundle = { Errors: Record<string, unknown> };

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../');

function loadLocale(name: 'en' | 'pl' | 'de' | 'ar'): LocaleBundle {
  return JSON.parse(
    readFileSync(join(root, 'apps/web-vite/messages', `${name}.json`), 'utf8'),
  ) as LocaleBundle;
}

const LOCALES = ['en', 'pl', 'de', 'ar'] as const;
type Locale = (typeof LOCALES)[number];

/** Page-level error layouts (heading/body/cta) share keys with some API codes. */
const isPageLayoutEntry = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && 'heading' in value;

/**
 * Non-code helpers that legitimately live under `Errors.*` without a matching
 * errors.ts export. Anything else flagged by the reverse-direction assertion
 * means either a stale locale entry or a forgotten errors.ts constant.
 *
 * The `validation*` entries here are client-side Zod schema messages used
 * directly by the frontend; they are not raised as API errors. A future
 * Zod sweep may move them under a separate `Validation` namespace.
 *
 * `taxFormNotFound` / `taxFormNotDraft` are UI-only strings rendered directly
 * by the W-form surface; no API procedure raises them (the tax-form routers
 * 404 with `contractorNotFound`), so they have no errors.ts export by design.
 */
const ALLOWED_NON_CODE_KEYS = new Set([
  'notFound',
  'serverError',
  'accountLocked',
  'generic',
  'taxFormNotFound',
  'taxFormNotDraft',
  'validationFailureReasonRequired',
  'validationIbanInvalid',
  'validationNipInvalid',
]);

describe('errors.ts vs i18n Errors namespace', () => {
  const bundles: Record<Locale, LocaleBundle> = {
    en: loadLocale('en'),
    pl: loadLocale('pl'),
    de: loadLocale('de'),
    ar: loadLocale('ar'),
  };

  const errorCodeExports: string[] = [];
  for (const [, value] of Object.entries(ApiErrors)) {
    if (typeof value !== 'string') continue;
    if (!/^[a-z][a-zA-Z0-9]+$/.test(value)) continue;
    errorCodeExports.push(value);
  }

  it.each(
    LOCALES,
  )('has a matching string translation in %s.json for each errors.ts code', locale => {
    const bundle = bundles[locale];
    for (const code of errorCodeExports) {
      if (isPageLayoutEntry(bundle.Errors[code])) continue;
      expect(typeof bundle.Errors[code], `${locale}.json Errors.${code} missing`).toBe('string');
      expect((bundle.Errors[code] as string).length).toBeGreaterThan(0);
    }
  });

  it('every string entry under en.json Errors maps to an exported errors.ts value or an allowed helper', () => {
    const exportedSet = new Set(errorCodeExports);
    for (const [key, value] of Object.entries(bundles.en.Errors)) {
      if (typeof value !== 'string') continue;
      if (ALLOWED_NON_CODE_KEYS.has(key)) continue;
      if (exportedSet.has(key)) continue;
      throw new Error(
        `en.json Errors.${key} has no matching export in errors.ts. ` +
          `Add the constant or list the key in ALLOWED_NON_CODE_KEYS in this test.`,
      );
    }
  });

  it('Errors.generic exists in every locale (client-side fallback)', () => {
    for (const locale of LOCALES) {
      const value = bundles[locale].Errors.generic;
      expect(typeof value, `${locale}.json Errors.generic missing`).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});
