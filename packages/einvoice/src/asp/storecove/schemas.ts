import { z } from "zod";

// ---------------------------------------------------------------------------
// Storecove API Response Schemas
// ---------------------------------------------------------------------------

/**
 * Validates a Storecove document submission response.
 * Uses .passthrough() for forward compatibility with new API fields.
 */
export const storecoveSubmissionResponseSchema = z
  .object({
    guid: z.string(),
    status: z.string(),
    document_url: z.string().optional(),
    created_at: z.string(),
  })
  .passthrough();

/**
 * Validates a Storecove legal entity response.
 */
export const storecoveLegalEntitySchema = z
  .object({
    id: z.number(),
    party_name: z.string(),
    peppol_identifiers: z.array(
      z.object({
        identifier: z.string(),
        scheme: z.string(),
        superscheme: z.string(),
      }),
    ),
  })
  .passthrough();

/**
 * Validates a Storecove received document.
 */
export const storecoveReceivedDocumentSchema = z
  .object({
    guid: z.string(),
    source: z.string(),
    document: z.string(),
    sender: z.object({
      identifier: z.string(),
      scheme: z.string(),
    }),
    created_at: z.string(),
  })
  .passthrough();

/**
 * Validates a Storecove webhook payload.
 */
export const storecoveWebhookPayloadSchema = z
  .object({
    guid: z.string(),
    event: z.string(),
    document_guid: z.string().optional(),
    document: z.string().optional(),
  })
  .passthrough();
