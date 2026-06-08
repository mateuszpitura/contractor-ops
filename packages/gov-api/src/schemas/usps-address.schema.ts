// Phase 84 · Plan 04 — USPS Addresses 3.0 API Zod schemas (US-FIELD-03, D-03).
//
// Source: https://developer.usps.com/addressesv3 (OAuth2 + Addresses 3.0).
// Field-name casing pinned from the official OpenAPI (developers.usps.com/api/81);
// the `safeParse` boundary in usps-client.ts converts any upstream drift into a
// fail-loud test failure rather than an unsafe `as` cast in production.
//
// Consumed by UspsAddressClient to parse:
//   - OAuth 2.0 client-credentials token response (POST /oauth2/v3/token)
//   - GET /addresses/v3/address success body (normalized address + additionalInfo)

import { z } from 'zod';

/**
 * OAuth2 client-credentials token response.
 *
 * `token_type` is matched case-insensitively (USPS returns `Bearer`; HMRC
 * returns `bearer`) — the value is informational only, the bearer is taken
 * verbatim from `access_token`.
 */
export const uspsOauthTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.number().int().positive(),
  // USPS sometimes omits `scope` on client-credentials grants — keep optional.
  scope: z.string().optional(),
});
export type UspsOauthToken = z.infer<typeof uspsOauthTokenSchema>;

/**
 * The normalized (CASS-standardized) address USPS returns for a match.
 *
 * `ZIPPlus4` is the 4-digit add-on and may be absent for some address types
 * (e.g. PO boxes), so it is optional. The other four components are present on
 * every successful match.
 */
export const uspsNormalizedAddressSchema = z.object({
  streetAddress: z.string().min(1),
  secondaryAddress: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  ZIPCode: z.string().min(1),
  ZIPPlus4: z.string().optional(),
});
export type UspsNormalizedAddress = z.infer<typeof uspsNormalizedAddressSchema>;

/**
 * Delivery-point and CASS metadata. `DPVConfirmation` is the load-bearing
 * deliverability signal: 'Y' (confirmed), 'D'/'S' (confirmed to default /
 * missing secondary), 'N' (not confirmed). The remaining flags are advisory.
 *
 * `passthrough` is intentional — USPS evolves `additionalInfo` independently of
 * our needs; unknown keys are non-breaking and must not fail the parse.
 */
export const uspsAdditionalInfoSchema = z
  .object({
    DPVConfirmation: z.string().optional(),
    business: z.string().optional(),
    vacant: z.string().optional(),
    centralDeliveryPoint: z.string().optional(),
  })
  .passthrough();
export type UspsAdditionalInfo = z.infer<typeof uspsAdditionalInfoSchema>;

/**
 * Full `GET /addresses/v3/address` success response.
 */
export const uspsAddressResponseSchema = z.object({
  address: uspsNormalizedAddressSchema,
  additionalInfo: uspsAdditionalInfoSchema.optional(),
});
export type UspsAddressResponse = z.infer<typeof uspsAddressResponseSchema>;
