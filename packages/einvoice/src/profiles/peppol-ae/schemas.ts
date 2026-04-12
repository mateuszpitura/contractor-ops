// ---------------------------------------------------------------------------
// PINT-AE Zod Schemas
// ---------------------------------------------------------------------------

import { z } from "zod";

/**
 * UAE Peppol Participant ID: scheme 0192 followed by 15-digit TRN.
 * Format: "0192:NNNNNNNNNNNNNNN"
 */
export const peppolParticipantIdSchema = z
  .string()
  .regex(/^0192:\d{15}$/, "Invalid UAE Peppol Participant ID (expected 0192:NNNNNNNNNNNNNNN)");

/**
 * Peppol connection configuration.
 */
export const peppolConnectionConfigSchema = z.object({
  participantId: peppolParticipantIdSchema,
  aspProvider: z.enum(["storecove"]),
  apiKey: z.string().min(1, "API key is required"),
  environment: z.enum(["sandbox", "production"]),
});

export type PeppolConnectionConfig = z.infer<typeof peppolConnectionConfigSchema>;

/**
 * Peppol transmission status values.
 */
export const peppolTransmissionStatusSchema = z.enum([
  "pending",
  "transmitted",
  "delivered",
  "failed",
]);

export type PeppolTransmissionStatusType = z.infer<typeof peppolTransmissionStatusSchema>;
