// Curated PTO keywords per locale.
// `ar` is intentionally absent — Gulf locale is not yet supported.
// Admin-managed per-locale additions are handled separately; this file is the
// static seed that bootstraps detection.

import type { PtoKeywords } from './types';

export const PTO_KEYWORDS: PtoKeywords = {
  en: ['PTO', 'OOO', 'Out of Office', 'Vacation'],
  de: ['Urlaub', 'Krank'],
  pl: ['Urlop', 'Wakacje'],
} as const;
