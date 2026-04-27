// Phase 61 — XRechnung profile Zod schemas.
//
// These are the boundary contracts consumed by:
//   - `packages/api/src/routers/einvoice.ts` (Plan 02 / 04): `finalizeEInvoice`
//     mutation input.
//   - `packages/einvoice/src/asp/storecove/adapter.ts` (Plan 05): `format`
//     discriminator on TransmitInvoiceParams, routing XRechnung-CII vs
//     UBL-PINT-AE vs UBL Peppol BIS 3 payloads.
//
// Keep this file thin — production logic lives in `generator.ts`, `validator.ts`,
// and the router layer. Only shape validation here.

import { z } from 'zod';

/** Input for the `einvoice.finalize` tRPC mutation (Plan 02). */
export const finalizeEInvoiceInputSchema = z.object({
  invoiceId: z.cuid(),
  force: z.boolean().optional().default(false),
});

export type FinalizeEInvoiceInput = z.infer<typeof finalizeEInvoiceInputSchema>;

/**
 * Format discriminator consumed by the Storecove adapter (D-09 / Plan 05).
 *
 * - `ubl-pint-ae` — existing UAE PINT payload route (peppol-ae profile).
 * - `cii-xrechnung` — XRechnung CII payload route, carrying the XRechnung
 *   CustomizationID + ProfileID pair to drive the right Storecove
 *   document-type lookup.
 * - `ubl-peppol-bis-3` — generic Peppol BIS 3 billing for non-XRechnung
 *   Peppol BIS sends (future use).
 */
export const eInvoiceFormatSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ubl-pint-ae') }),
  z.object({
    kind: z.literal('cii-xrechnung'),
    customizationId: z.string(),
    profileId: z.string(),
  }),
  z.object({ kind: z.literal('ubl-peppol-bis-3') }),
]);

export type EInvoiceFormat = z.infer<typeof eInvoiceFormatSchema>;
