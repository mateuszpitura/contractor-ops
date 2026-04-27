// Phase 74 Plan 01 — Wave 0 stub. Plan 74-02 fills the per-locale PTO keyword
// lists (en/pl/de) per CONTEXT.md D-08. Ops-extension (admin-managed
// per-locale additions) lands in Plan 74-07 Settings UI.

import type { PtoKeywords } from './types.js';

export const PTO_KEYWORDS: PtoKeywords = {
  en: [],
  de: [],
  pl: [],
} as const;
