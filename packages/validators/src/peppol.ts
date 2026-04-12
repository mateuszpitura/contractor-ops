import { z } from "zod";

// ---------------------------------------------------------------------------
// Peppol Participant ID
// ---------------------------------------------------------------------------

/**
 * UAE Peppol Participant ID: scheme 0192 + 15-digit TRN.
 * Format: "0192:NNNNNNNNNNNNNNN"
 */
export const peppolParticipantIdSchema = z
  .string()
  .regex(
    /^0192:\d{15}$/,
    "Invalid UAE Peppol Participant ID (expected 0192:NNNNNNNNNNNNNNN)",
  );

export type PeppolParticipantId = z.infer<typeof peppolParticipantIdSchema>;

// ---------------------------------------------------------------------------
// Connect to Peppol
// ---------------------------------------------------------------------------

export const connectPeppolSchema = z.object({
  trn: z
    .string()
    .length(15, "TRN must be exactly 15 digits")
    .regex(/^\d+$/, "TRN must be 15 digits"),
  aspProvider: z.enum(["storecove"]),
  apiKey: z.string().min(1, "API key required"),
  environment: z.enum(["sandbox", "production"]),
});

export type ConnectPeppolInput = z.infer<typeof connectPeppolSchema>;

// ---------------------------------------------------------------------------
// Transmit Invoice
// ---------------------------------------------------------------------------

export const transmitInvoiceSchema = z.object({
  invoiceId: z.string().cuid(),
  receiverParticipantId: peppolParticipantIdSchema,
});

export type TransmitInvoiceInput = z.infer<typeof transmitInvoiceSchema>;

// ---------------------------------------------------------------------------
// Get Transmissions (paginated)
// ---------------------------------------------------------------------------

export const getTransmissionsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
});

export type GetTransmissionsInput = z.infer<typeof getTransmissionsSchema>;

// ---------------------------------------------------------------------------
// Get Transmission by Invoice ID
// ---------------------------------------------------------------------------

export const getTransmissionByInvoiceIdSchema = z.object({
  invoiceId: z.string().cuid(),
});

export type GetTransmissionByInvoiceIdInput = z.infer<typeof getTransmissionByInvoiceIdSchema>;

// ---------------------------------------------------------------------------
// Retry Transmission
// ---------------------------------------------------------------------------

export const retryTransmissionSchema = z.object({
  transmissionId: z.string().cuid(),
});

export type RetryTransmissionInput = z.infer<typeof retryTransmissionSchema>;
