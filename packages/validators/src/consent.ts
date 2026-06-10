import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prisma enum mirror (string union — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const consentPurposeEnum = z.enum([
  'CONTRACTOR_DATA_PROCESSING',
  'INVOICE_PAYMENT_PROCESSING',
  'ANALYTICS_REPORTING',
  'CROSS_BORDER_TRANSFER',
  'INTEGRATION_DATA_SHARING',
  'COMMUNICATION_NOTIFICATIONS',
]);

export type ConsentPurpose = z.infer<typeof consentPurposeEnum>;

// ---------------------------------------------------------------------------
// Purpose classification — required vs optional during onboarding
// ---------------------------------------------------------------------------

/** Purposes that MUST be accepted during onboarding (blocking) */
export const REQUIRED_PURPOSES: ConsentPurpose[] = [
  'CONTRACTOR_DATA_PROCESSING',
  'INVOICE_PAYMENT_PROCESSING',
  'COMMUNICATION_NOTIFICATIONS',
];

/** Purposes that are optional during onboarding */
export const OPTIONAL_PURPOSES: ConsentPurpose[] = [
  'ANALYTICS_REPORTING',
  'CROSS_BORDER_TRANSFER',
  'INTEGRATION_DATA_SHARING',
];

// ---------------------------------------------------------------------------
// Jurisdiction detection
// ---------------------------------------------------------------------------

/** Jurisdiction codes that trigger PDPL compliance */
export const PDPL_JURISDICTIONS = ['AE', 'SA'] as const;
export type PdplJurisdiction = (typeof PDPL_JURISDICTIONS)[number];

/** Check if a country code requires PDPL compliance */
export function isPdplJurisdiction(
  countryCode: string | null | undefined,
): countryCode is PdplJurisdiction {
  return PDPL_JURISDICTIONS.includes(countryCode as PdplJurisdiction);
}

// ---------------------------------------------------------------------------
// UK/DE privacy acknowledgement gate
// ---------------------------------------------------------------------------

/**
 * Jurisdiction codes that must surface the onboarding privacy-notice
 * acknowledgement gate. Extends the PDPL (AE/SA) jurisdictions with the
 * UK and German GDPR jurisdictions.
 *
 * Kept deliberately additive — `isPdplJurisdiction` is unchanged so the
 * existing PDPL-specific code paths (legal references, notice content)
 * continue to narrow exclusively to AE/SA.
 */
export function requiresPrivacyAcknowledgement(countryCode: string | null | undefined): boolean {
  if (isPdplJurisdiction(countryCode)) return true;
  const upper = typeof countryCode === 'string' ? countryCode.toUpperCase() : '';
  return upper === 'GB' || upper === 'DE';
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const grantConsentSchema = z.object({
  purpose: consentPurposeEnum,
  granted: z.boolean(),
});
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;

export const bulkGrantConsentSchema = z.object({
  consents: z.array(grantConsentSchema).min(1),
  /**
   * Privacy notice acknowledgement flag.
   * Optional for existing PDPL flows (AE/SA); onboarding UI enforces `true`
   * for UK/DE via `requiresPrivacyAcknowledgement`. Server-side enforcement
   * for UK/DE is a security invariant.
   */
  privacyNoticeAcknowledged: z.boolean().optional(),
  /** ISO-3166 alpha-2 jurisdiction of the notice the user acknowledged. */
  privacyNoticeJurisdiction: z.enum(['AE', 'SA', 'GB', 'DE', 'EU']).optional(),
  /** Version number of the notice content that was acknowledged. */
  privacyNoticeVersion: z.number().int().positive().optional(),
});
export type BulkGrantConsentInput = z.infer<typeof bulkGrantConsentSchema>;

export const consentQuerySchema = z.object({
  purpose: consentPurposeEnum.optional(),
});
export type ConsentQueryInput = z.infer<typeof consentQuerySchema>;

export const consentAdminQuerySchema = z.object({
  userId: z.string().min(1),
  purpose: consentPurposeEnum.optional(),
});
export type ConsentAdminQueryInput = z.infer<typeof consentAdminQuerySchema>;
