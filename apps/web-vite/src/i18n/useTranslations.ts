/**
 * Compat hook mirroring `next-intl`'s `useTranslations(namespace)` shape.
 *
 * The ~545 next-intl consumers in apps/web/src/** call:
 *
 *     const t = useTranslations('contractors.detail');
 *     t('title');                 // → "Contractor detail"
 *     t('greeting', { name });    // → "Hello {name}!"
 *
 * react-i18next's native `useTranslation(ns)` returns `{ t }` with the
 * same `(key, vars?) => string` signature but accepts ICU values under a
 * single positional argument. This wrapper hides the destructure so the
 * Step 11 codemod swap is a one-line import path change per file
 * (`from 'next-intl'` → `from '@/i18n/useTranslations'`).
 *
 * Dot-prefix matches the legacy "namespace" semantics: `useTranslations('a.b')`
 * makes `t('c')` resolve to key `'a.b.c'` in the underlying flat bundle.
 */

import { useTranslation } from 'react-i18next';

export type TranslateValues = Record<string, string | number | Date | null | undefined>;

export interface TranslateFn {
  (key: string): string;
  (key: string, values: TranslateValues): string;
  rich?(key: string, values: TranslateValues): string;
}

export function useTranslations(namespace?: string): TranslateFn {
  const { t } = useTranslation('translation');
  const prefix = namespace ? `${namespace}.` : '';
  const fn: TranslateFn = (key: string, values?: TranslateValues) => {
    const result = t(`${prefix}${key}`, (values ?? {}) as TranslateValues);
    return typeof result === 'string' ? result : String(result);
  };
  // `rich` parity stub — next-intl callers occasionally use it for
  // React-element interpolation. Implementation lands in Step 11
  // alongside the consumer codemod, once the call-sites that need it
  // are catalogued.
  fn.rich = (key, values) => fn(key, values);
  return fn;
}

/** Re-export react-i18next's namespaced hook so power users can opt out. */
export { useTranslation } from 'react-i18next';
