// ZUGFeRD profile Zod schemas.
//
// Thin re-export of the XRechnung envelope schemas (ZUGFeRD carries the same
// canonical EInvoice contract inside factur-x.xml) plus a ZUGFeRD-specific
// upload-intake schema for the inbound PDF route.
//
// Keep this file small — semantic validation lives in the parser + validator
// delegate. Schemas here guard only shape + transport invariants.

import { z } from 'zod';

// biome-ignore lint/performance/noBarrelFile: not a barrel — profile schema module; re-exports shared envelope schemas alongside its own ZUGFeRD intake schema
export {
  eInvoiceLineSchema as EInvoiceLineSchema,
  eInvoicePartySchema,
  eInvoicePaymentMeansSchema,
  eInvoiceSchema as EInvoiceSchema,
  eInvoiceTaxSubtotalSchema,
} from '../../schemas/invoice.js';

/**
 * tRPC input schema for the ZUGFeRD PDF intake upload mutation.
 *
 * Constraints:
 *   - `base64` is a non-empty string (the router decodes before calling the
 *     parser; the parser itself accepts `Uint8Array`, so decoding failure is
 *     reported as `INVALID_BASE64`).
 *   - `filename` must end with `.pdf` (case-insensitive) and not exceed
 *     255 characters — matches typical FS limits and guards against
 *     path-injection attempts in downstream R2 keys.
 */
export const ZugferdPdfUploadSchema = z.object({
  base64: z.string().min(1),
  filename: z
    .string()
    .regex(/\.pdf$/i)
    .max(255),
});

export type ZugferdPdfUpload = z.infer<typeof ZugferdPdfUploadSchema>;
