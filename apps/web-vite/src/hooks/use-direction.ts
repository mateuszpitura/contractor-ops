import { useMemo } from 'react';
import type { Locale } from '../i18n/messages.js';
import { localeMeta } from '../i18n/messages.js';
import { useLocale } from '../i18n/navigation.js';

export type TextDirection = 'ltr' | 'rtl';

/**
 * Resolves document text direction from the active locale (RTL for `ar`).
 * Prefer logical Tailwind (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) in
 * table/sheet/dialog shells so padding and alignment flip under `dir="rtl"`.
 */
export function useDirection(): TextDirection {
  const locale = useLocale();
  return useMemo(() => localeMeta[locale as Locale]?.dir ?? 'ltr', [locale]);
}
