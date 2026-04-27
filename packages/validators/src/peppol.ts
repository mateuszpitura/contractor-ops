import { z } from 'zod';

// ---------------------------------------------------------------------------
// Peppol Participant ID
// ---------------------------------------------------------------------------

/**
 * UAE Peppol Participant ID: scheme 0192 + 15-digit TRN.
 * Format: "0192:NNNNNNNNNNNNNNN"
 */
export const peppolParticipantIdSchema = z
  .string()
  .regex(/^0192:\d{15}$/, 'Invalid UAE Peppol Participant ID (expected 0192:NNNNNNNNNNNNNNN)');

export type PeppolParticipantId = z.infer<typeof peppolParticipantIdSchema>;

// ---------------------------------------------------------------------------
// Peppol scheme-id + value primitives (Phase 61 Plan 05)
// ---------------------------------------------------------------------------
//
// The Peppol ICD (Issuing Code List) registers every jurisdiction's
// scheme-id as a 4-digit code (0060 UK Companies House, 0088 GLN, 0106 DUNS,
// 0192 Norway orgnr, 9930 DE Leitweg, 9957 DE Steuernummer, …).
// Participant values are capped at 64 chars per Storecove's documented limit.
//
// Consumed by Plan 05 UI forms (Settings → E-invoicing) and by the
// capability-lookup tRPC procedure. The paired refinement
// (`peppolParticipantPairSchema`) lives in `./leitweg-id.ts` to colocate
// with Contractor boundary validation; re-exported from the package root.

export const peppolSchemeIdSchema = z.string().regex(/^\d{4}$/, 'Peppol schemeId must be 4 digits');

export const peppolParticipantValueSchema = z
  .string()
  .min(1, 'Peppol participant value cannot be empty')
  .max(64, 'Peppol participant value too long');

// ---------------------------------------------------------------------------
// Capability lookup (Phase 61 Plan 05 — D-11)
// ---------------------------------------------------------------------------

/**
 * Input to the `peppol.lookupCapabilities` tRPC query. Resolves to a cached
 * or fresh list of doc-type IDs the Peppol participant advertises, plus a
 * computed `supportsXRechnungCii` boolean for the UI's send-gate badge.
 */
export const peppolLookupCapabilitiesSchema = z.object({
  schemeId: peppolSchemeIdSchema,
  value: peppolParticipantValueSchema,
  forceRefresh: z.boolean().optional().default(false),
});

export type PeppolLookupCapabilitiesInput = z.infer<typeof peppolLookupCapabilitiesSchema>;

// ---------------------------------------------------------------------------
// Connect to Peppol
// ---------------------------------------------------------------------------

export const connectPeppolSchema = z.object({
  trn: z
    .string()
    .length(15, 'TRN must be exactly 15 digits')
    .regex(/^\d+$/, 'TRN must be 15 digits'),
  aspProvider: z.enum(['storecove']),
  apiKey: z.string().min(1, 'API key required'),
  environment: z.enum(['sandbox', 'production']),
});

export type ConnectPeppolInput = z.infer<typeof connectPeppolSchema>;

// ---------------------------------------------------------------------------
// Transmit Invoice
// ---------------------------------------------------------------------------

export const transmitInvoiceSchema = z.object({
  invoiceId: z.cuid(),
  receiverParticipantId: peppolParticipantIdSchema,
});

export type TransmitInvoiceInput = z.infer<typeof transmitInvoiceSchema>;

// ---------------------------------------------------------------------------
// Get Transmissions (paginated)
// ---------------------------------------------------------------------------

export const getTransmissionsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
});

export type GetTransmissionsInput = z.infer<typeof getTransmissionsSchema>;

// ---------------------------------------------------------------------------
// Get Transmission by Invoice ID
// ---------------------------------------------------------------------------

export const getTransmissionByInvoiceIdSchema = z.object({
  invoiceId: z.cuid(),
});

export type GetTransmissionByInvoiceIdInput = z.infer<typeof getTransmissionByInvoiceIdSchema>;

// ---------------------------------------------------------------------------
// Retry Transmission
// ---------------------------------------------------------------------------

export const retryTransmissionSchema = z.object({
  transmissionId: z.cuid(),
});

export type RetryTransmissionInput = z.infer<typeof retryTransmissionSchema>;
