/**
 * Privacy-notice jurisdiction routing helpers — ported from
 * apps/web/src/app/[locale]/(legal)/legal/privacy/_resolve.ts.
 */

/** Jurisdiction slugs the /legal/privacy pages are allowed to render. */
export const PRIVACY_JURISDICTION_SLUGS = ['gb', 'de', 'eu'] as const;
export type PrivacyJurisdictionSlug = (typeof PRIVACY_JURISDICTION_SLUGS)[number];

export function isPrivacyJurisdictionSlug(value: string): value is PrivacyJurisdictionSlug {
  return (PRIVACY_JURISDICTION_SLUGS as readonly string[]).includes(value);
}

export const JURISDICTION_LABEL: Record<PrivacyJurisdictionSlug, 'GB' | 'DE' | 'EU'> = {
  gb: 'GB',
  de: 'DE',
  eu: 'EU',
};
