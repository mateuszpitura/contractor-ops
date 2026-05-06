// ---------------------------------------------------------------------------
// E-Sign Types & Adapter Interface
// ---------------------------------------------------------------------------

/**
 * Request to create a signing envelope with one or more signers.
 */
export interface SigningEnvelopeRequest {
  /**
   * Tenant scope used for idempotency-key derivation (DRIFT-01).
   *
   * The orchestrator (`packages/api/src/services/esign-orchestrator.ts`)
   * always plumbs the caller's organization id; only legacy / test paths
   * may omit it, in which case the adapter falls back to the
   * integration connection id (already org-scoped at the DB level).
   */
  organizationId?: string;
  documentBase64: string;
  documentName: string;
  signers: SignerInfo[];
  message?: string;
  expiresInDays?: number;
  reminderIntervalDays?: number;
  embeddedReturnUrl?: string;
}

/**
 * Information about a signer in a signing envelope.
 */
export interface SignerInfo {
  name: string;
  email: string;
  role: 'signer' | 'countersigner';
  routingOrder: number;
  /** Set for embedded signing (DocuSign uses this to identify in-session signers). */
  clientUserId?: string;
}

/**
 * Result after creating or querying a signing envelope.
 */
export interface SigningEnvelopeResult {
  externalEnvelopeId: string;
  status: string;
  signers: { externalRecipientId: string; email: string; status: string }[];
}

/**
 * Result containing an embedded signing URL (e.g., DocuSign recipient view).
 *
 * F-INT-16: DocuSign recipient-view URLs are short-lived — the URL is
 * single-use and account policies cap validity to ~5 minutes by default.
 * Callers MUST treat `expiresAt` as authoritative and re-issue via
 * `getEmbeddedSigningUrl` (or the provider-specific re-issue method) when
 * within the safety margin. `ttlSeconds` is surfaced for clients that
 * want to schedule a refresh before the absolute expiry tips over.
 */
export interface EmbeddedSigningUrlResult {
  url: string;
  /** ISO 8601 timestamp marking the latest moment the URL is valid. */
  expiresAt?: string;
  /** Documented validity window in seconds from issuance. */
  ttlSeconds?: number;
}

/**
 * Result containing the signed document content.
 */
export interface SignedDocumentResult {
  documentBase64: string;
  mimeType: string;
  fileName: string;
}

/**
 * Normalized signing event from any provider webhook.
 */
export interface NormalizedSigningEvent {
  externalEnvelopeId: string;
  eventType:
    | 'ENVELOPE_CREATED'
    | 'ENVELOPE_SENT'
    | 'RECIPIENT_VIEWED'
    | 'RECIPIENT_SIGNED'
    | 'RECIPIENT_DECLINED'
    | 'ENVELOPE_COMPLETED'
    | 'ENVELOPE_VOIDED'
    | 'ENVELOPE_EXPIRED';
  recipientEmail?: string;
  recipientStatus?: 'PENDING' | 'SENT' | 'DELIVERED' | 'VIEWED' | 'SIGNED' | 'DECLINED';
  envelopeStatus?:
    | 'CREATED'
    | 'SENT'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'DECLINED'
    | 'VOIDED'
    | 'EXPIRED';
  actorName?: string;
  actorEmail?: string;
  description: string;
  providerEventId?: string;
  occurredAt: Date;
}

/**
 * Provider-agnostic interface for e-sign operations.
 * Implemented by DocuSignAdapter and AutentiAdapter.
 */
export interface ESignAdapter {
  createEnvelope(
    connectionId: string,
    request: SigningEnvelopeRequest,
  ): Promise<SigningEnvelopeResult>;

  getEmbeddedSigningUrl(
    connectionId: string,
    envelopeId: string,
    recipientEmail: string,
    returnUrl: string,
  ): Promise<EmbeddedSigningUrlResult>;

  getSignedDocument(connectionId: string, envelopeId: string): Promise<SignedDocumentResult>;

  getEnvelopeStatus(connectionId: string, envelopeId: string): Promise<SigningEnvelopeResult>;

  voidEnvelope(connectionId: string, envelopeId: string, reason: string): Promise<void>;

  resendToRecipient(
    connectionId: string,
    envelopeId: string,
    recipientEmail: string,
  ): Promise<void>;

  normalizeWebhookEvent(payload: unknown): NormalizedSigningEvent;

  readonly supportsEmbeddedSigning: boolean;
}
