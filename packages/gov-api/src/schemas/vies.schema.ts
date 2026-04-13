// Phase 57 · Plan 01 — VIES REST API Zod schema (PAY-05, D-06).
//
// Source: https://ec.europa.eu/taxation_customs/vies/rest-api/
// Endpoint: GET /rest-api/ms/:ms/vat/:vrn?requesterMemberStateCode=&requesterNumber=
//
// Notes:
//   - Either `isValid` OR `userError` MUST be present — .refine() enforces
//     this so the D-08 soft-fail path can reliably branch.
//   - Qualified responses include `requestIdentifier` (consultationNumber);
//     simple responses omit it.

import { z } from 'zod';

export const viesLookupResponseSchema = z
  .object({
    countryCode: z.string().length(2),
    vatNumber: z.string(),
    requestDate: z.string().optional(),
    isValid: z.boolean().optional(), // absent when userError is set
    name: z.string().optional(),
    address: z.string().optional(),
    traderName: z.string().optional(),
    traderCompanyType: z.string().optional(),
    traderAddress: z.string().optional(),
    requestIdentifier: z.string().optional(), // consultationNumber on qualified
    userError: z
      .enum([
        'MS_UNAVAILABLE',
        'SERVICE_UNAVAILABLE',
        'INVALID_INPUT',
        'GLOBAL_MAX_CONCURRENT_REQ',
        'MS_MAX_CONCURRENT_REQ',
        'TIMEOUT',
      ])
      .optional(),
    traderNameMatch: z.enum(['1', '2', '3']).optional(),
    traderStreetMatch: z.enum(['1', '2', '3']).optional(),
    traderPostcodeMatch: z.enum(['1', '2', '3']).optional(),
    traderCityMatch: z.enum(['1', '2', '3']).optional(),
  })
  .refine(data => data.isValid !== undefined || data.userError !== undefined, {
    message: 'VIES response must contain either isValid or userError',
  });

export type ViesLookupResponse = z.infer<typeof viesLookupResponseSchema>;
