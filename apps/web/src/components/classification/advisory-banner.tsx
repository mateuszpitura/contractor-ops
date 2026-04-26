// apps/web/src/components/classification/advisory-banner.tsx
//
// Phase 64 · D-17 — Non-dismissible classification advisory banner (LEGAL-03).
//
// Rendered by the classification route layout.tsx above {children}.
// Every classification page inherits it without per-page plumbing.
//
// Design:
//   - Sticky at top of scroll container (z-10)
//   - Amber palette: bg-amber-50 border-amber-400 text-amber-900
//   - role="note" for screen reader accessibility
//   - No close button — non-dismissible (legally required context, not noise)
//   - Jurisdiction-aware: GB → IR35 English phrase, DE/AT → Scheinselbständigkeit German phrase

import { BANNER_IR35_ADVISORY_EN, BANNER_SCHEIN_ADVISORY_DE } from '@contractor-ops/validators';

interface ClassificationAdvisoryBannerProps {
  /** ISO 3166-1 alpha-2 country code from the org context */
  jurisdiction: string;
}

/**
 * Persistent advisory banner displayed on every classification route.
 * Non-dismissible — displays locked regulatory disclaimer text.
 * Amber palette matches Phase 60 compliance-pill colour tokens.
 */
export function ClassificationAdvisoryBanner({ jurisdiction }: ClassificationAdvisoryBannerProps) {
  const isDE = jurisdiction === 'DE' || jurisdiction === 'AT';
  const phrase = isDE ? BANNER_SCHEIN_ADVISORY_DE : BANNER_IR35_ADVISORY_EN;

  return (
    <div
      role="note"
      aria-label={isDE ? 'Rechtlicher Hinweis' : 'Legal notice'}
      className="sticky top-0 z-10 border-b border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="max-w-4xl">{phrase}</p>
    </div>
  );
}
