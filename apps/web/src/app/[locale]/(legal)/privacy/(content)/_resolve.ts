// Phase 56 · Plan 07 — Shared helpers for privacy-notice jurisdiction routing.
//
// Used by both page.tsx (unauth picker / authenticated redirect) and the
// Wave 0 test scaffolds under `../__tests__/`. Imports from the pure
// validators module (no Prisma / Node side effects) so it's safe to bundle
// into client components.

import { resolveJurisdiction } from '@contractor-ops/validators';

/**
 * Map an organization's countryCode to a privacy-notice URL path.
 * Output paths are locale-agnostic (next-intl `Link` appends the locale
 * prefix); the caller is responsible for locale-prefixing if needed.
 *
 * D-09 fallback: unknown / unsupported countryCode -> /legal/privacy/eu.
 * GB / DE / AE / SA get their dedicated notices.
 */
export function resolvePrivacyRedirect(
  args: { countryCode: string | null | undefined },
):
  | '/legal/privacy/gb'
  | '/legal/privacy/de'
  | '/legal/privacy/eu'
  | '/legal/privacy/ae'
  | '/legal/privacy/sa' {
  const jurisdiction = resolveJurisdiction(args.countryCode);
  const slug = jurisdiction.toLowerCase();
  return `/legal/privacy/${slug}` as
    | '/legal/privacy/gb'
    | '/legal/privacy/de'
    | '/legal/privacy/eu'
    | '/legal/privacy/ae'
    | '/legal/privacy/sa';
}

/** Jurisdiction slugs the /legal/privacy pages are allowed to render. */
export const PRIVACY_JURISDICTION_SLUGS = ['gb', 'de', 'eu'] as const;
export type PrivacyJurisdictionSlug = (typeof PRIVACY_JURISDICTION_SLUGS)[number];

export function isPrivacyJurisdictionSlug(value: string): value is PrivacyJurisdictionSlug {
  return (PRIVACY_JURISDICTION_SLUGS as readonly string[]).includes(value);
}
