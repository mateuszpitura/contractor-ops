// Phase 74 Plan 02 — Curated PTO keywords per locale (D-08).
// `ar` is intentionally NOT shipped this phase (Phase 79 owns the Gulf locale).
// Ops-extension (admin-managed per-locale additions) lands in Plan 74-07
// Settings UI; this file is the static seed that bootstraps detection.

import type { PtoKeywords } from './types';

export const PTO_KEYWORDS: PtoKeywords = {
  en: ['PTO', 'OOO', 'Out of Office', 'Vacation'],
  de: ['Urlaub', 'Krank'],
  pl: ['Urlop', 'Wakacje'],
} as const;
