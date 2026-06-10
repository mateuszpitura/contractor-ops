import { createHash } from 'node:crypto';

/**
 * Inputs for {@link deriveIdempotencyKey}.
 *
 * The trio (orgId, operation, businessKey) is the canonical
 * idempotency-key composition. All upstream provider calls that need a
 * deterministic dedup key MUST derive it through this helper so that the
 * same logical business operation, retried via any code path, collapses
 * to the same hash.
 */
export interface IdempotencyInputs {
  /**
   * Stable tenant scope. Use the organization id when the operation has a
   * tenant context. For pre-tenancy auth flows (e.g. password reset for an
   * email that has not yet selected an org) callers may pass the
   * {@link GLOBAL_ORG_SENTINEL} sentinel so the key still partitions away
   * from any future tenant-scoped key.
   */
  orgId: string;
  /**
   * Stable operation discriminator using a `<provider>.<entity>.<verb>`
   * dotted form, e.g. `'docusign.envelope.create'`,
   * `'storecove.peppol.send'`, `'auth.email.magic-link'`,
   * `'google-calendar.event.create'`.
   *
   * The operation must be stable across deploys — changing it invalidates
   * every in-flight idempotency window for that operation.
   */
  operation: string;
  /**
   * Stable identifier of the business object the operation acts on.
   *
   * For entity-scoped operations this is typically the entity id (invoice
   * id, contract id, calendar event id). For content-scoped operations
   * with no natural id (e.g. an outbound email) it is a canonical hash of
   * the relevant content tuple — recipient + template + canonical body.
   *
   * The value is fed verbatim into the digest, so callers SHOULD compose
   * deterministic strings (sorted keys, normalised whitespace) to keep
   * the key stable across retries.
   */
  businessKey: string;
}

/**
 * Sentinel used in `orgId` when the operation genuinely has no tenant
 * context (e.g. magic-link sign-in for an email that has not yet joined an
 * org). Keeps the helper pure — no env reads, no coupling to auth state —
 * while still segregating orgless keys from any future tenant key.
 */
export const GLOBAL_ORG_SENTINEL = '_global' as const;

/**
 * Canonical idempotency-key derivation used by every external-provider
 * adapter (DocuSign, Storecove/Peppol, Google Calendar, Outlook Calendar,
 * Resend auth emails, ...).
 *
 * Returns the lowercase hex sha256 digest of the canonical
 * `${orgId}:${operation}:${businessKey}` composition. The output is 64
 * characters (256 bits) which fits inside every provider's idempotency
 * header limit (Resend 256, Storecove 64, DocuSign 100, Stripe 255).
 *
 * The composition is intentionally pure:
 * - no env-var pepper (a pepper is a separate F-SEC-style concern; mixing
 *   it in here would make keys unstable across deploys / regions);
 * - no timestamp (idempotency windows are managed by the downstream
 *   provider, not by the caller);
 * - no random salt (callers needing uniqueness should compose it into
 *   `businessKey`).
 *
 * **Outbox exception.** Outbox handlers do NOT call this helper. The
 * outbox table assigns each event a UUID `id` on insert (`OutboxEvent.id`),
 * which is the composed business key by design — a single UUID
 * encapsulates org scope, operation type, and business object in one
 * monotonic identifier. Forcing outbox handlers through this helper would
 * double-hash an already canonical key without adding determinism. The
 * outbox dispatcher passes `OutboxEvent.id` directly as the downstream
 * idempotency key (see `packages/api/src/services/outbox/handlers.ts`).
 *
 * @param inputs - tenant scope, operation discriminator, and business key
 * @returns lowercase 64-character hex string suitable for any provider header
 *
 * @example
 * ```ts
 * const key = deriveIdempotencyKey({
 *   orgId: 'org_abc',
 *   operation: 'docusign.envelope.create',
 *   businessKey: contractId,
 * });
 * apiClient.addDefaultHeader('X-DocuSign-Idempotency-Key', key);
 * ```
 */
export function deriveIdempotencyKey(inputs: IdempotencyInputs): string {
  const { orgId, operation, businessKey } = inputs;
  return createHash('sha256').update(`${orgId}:${operation}:${businessKey}`).digest('hex');
}
