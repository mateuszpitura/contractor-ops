// HMRC VAT Registration API Zod schemas.
//
// Source: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-registered-companies-api
//
// Consumed by HmrcVatClient to parse:
//   - OAuth 2.0 client-credentials token response
//   - /organisations/vat/check-vat-number/lookup/:targetVrn/:requesterVrn? success body
//   - HMRC error envelope

import { z } from 'zod';

export const hmrcOauthTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('bearer'),
  expires_in: z.number().int().positive(),
  scope: z.string(),
});
export type HmrcOauthToken = z.infer<typeof hmrcOauthTokenSchema>;

export const hmrcVatLookupResponseSchema = z.object({
  processingDate: z.string(),
  target: z.object({
    name: z.string(),
    vatNumber: z.string(),
    address: z.object({
      line1: z.string(),
      postcode: z.string(),
      countryCode: z.string().length(2),
    }),
  }),
  requester: z.string().optional(), // present on verified (two-arg) lookup
  consultationNumber: z.string().optional(), // present on verified lookup
});
export type HmrcVatLookupResponse = z.infer<typeof hmrcVatLookupResponseSchema>;

export const hmrcVatErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type HmrcVatErrorResponse = z.infer<typeof hmrcVatErrorResponseSchema>;
