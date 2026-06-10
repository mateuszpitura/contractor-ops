import { z } from 'zod';

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

/**
 * Storecove /discovery/receives response envelope.
 *
 * The exact shape of the Storecove discovery response has two observed
 * variants across the Storecove documentation + community posts:
 *
 *   (a) `{ documentTypes: string[] }` — flat array.
 *   (b) `{ processes: [{ documentTypes: string[] }, ...] }` — nested per
 *       Peppol business process.
 *
 * The schema below accepts both with `.passthrough()` so forward-compatible
 * fields survive Zod parsing. `extractDocumentTypes` flattens the result to
 * the single `string[]` contract the capability cache stores.
 */
export const storecoveDiscoveryResponseSchema = z
  .object({
    documentTypes: z.array(z.string()).optional(),
    processes: z
      .array(
        z
          .object({
            documentTypes: z.array(z.string()),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export type StorecoveDiscoveryResponse = z.infer<typeof storecoveDiscoveryResponseSchema>;

/**
 * Flatten a parsed Storecove discovery response to the normalised
 * `string[]` contract consumed by `ParticipantCapabilityResult.documentTypes`.
 *
 * Deduplicates because nested `processes[]` variants often repeat doc types
 * across multiple business processes (invoicing + credit note).
 */
export function extractDocumentTypes(raw: StorecoveDiscoveryResponse): string[] {
  const collected: string[] = [];
  if (raw.documentTypes) collected.push(...raw.documentTypes);
  if (raw.processes) {
    for (const process of raw.processes) {
      collected.push(...process.documentTypes);
    }
  }
  return Array.from(new Set(collected));
}
