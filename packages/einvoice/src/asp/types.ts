// ---------------------------------------------------------------------------
// ASP (Accredited Service Provider) Adapter Interface
// ---------------------------------------------------------------------------

/**
 * Registration parameters for a Peppol participant.
 */
export interface RegisterParticipantParams {
  participantId: string;
  schemeId: string;
  identifierValue: string;
  organizationName: string;
  /** Organization ID for rate limiting and audit logging (optional). */
  organizationId?: string;
}

/**
 * Result of registering a participant with the ASP.
 */
export interface ParticipantRegistration {
  registrationId: string;
  participantId: string;
  status: 'pending' | 'registered' | 'failed';
  registeredAt?: Date;
}

/**
 * Current status of a registered participant.
 */
export interface ParticipantStatus {
  participantId: string;
  status: 'pending' | 'registered' | 'active' | 'suspended' | 'deregistered';
}

/**
 * E-invoice format discriminator carried on `TransmitInvoiceParams`. Mirrors
 * the Zod discriminated union in `profiles/xrechnung-de/schemas.ts`
 * (`eInvoiceFormatSchema`) so the type system and the runtime contract stay
 * in sync.
 *
 * - `ubl-pint-ae` — existing UAE PINT payload route (peppol-ae profile).
 * - `cii-xrechnung` — XRechnung CII payload route; carries the XRechnung
 *   CustomizationID + ProfileID pair so downstream fixtures can assert the
 *   dual-profile contract stayed intact end-to-end.
 * - `ubl-peppol-bis-3` — generic Peppol BIS 3 billing for non-XRechnung
 *   Peppol BIS sends (future use).
 */
export type EInvoiceFormat =
  | { kind: 'ubl-pint-ae' }
  | { kind: 'cii-xrechnung'; customizationId: string; profileId: string }
  | { kind: 'ubl-peppol-bis-3' };

/**
 * Parameters for transmitting an invoice via the ASP.
 *
 * Backwards-compatible: legacy callers that still pass `documentTypeId`
 * without a `format` continue to work unchanged. When both are provided,
 * `format` wins — the adapter maps the format to the provider-specific
 * document_type_id string.
 */
export interface TransmitInvoiceParams {
  xml: string;
  senderParticipantId: string;
  receiverParticipantId: string;
  documentTypeId: string;
  /** Optional format discriminator; when provided overrides `documentTypeId` routing. */
  format?: EInvoiceFormat;
  /** Organization ID for rate limiting and audit logging (optional). */
  organizationId?: string;
}

/**
 * Input for a per-recipient Peppol SML capability probe. The caller supplies
 * the receiver's Peppol scheme + participant value; the adapter returns the
 * list of document-type IDs that participant has registered on the Peppol
 * network (SMP).
 */
export interface LookupParticipantCapabilitiesParams {
  schemeId: string;
  value: string;
  /** Organization ID for rate limiting and audit logging (optional). */
  organizationId?: string;
}

/**
 * Normalized capability lookup result. Regardless of whether Storecove
 * returns a flat `documentTypes` array or a nested `processes[].documentTypes`
 * shape, the adapter flattens to this contract so downstream consumers
 * (PeppolCapabilityCache + pre-flight helpers) stay provider-agnostic.
 */
export interface ParticipantCapabilityResult {
  schemeId: string;
  value: string;
  documentTypes: string[];
  fetchedAt: Date;
}

/**
 * Result of transmitting an invoice.
 */
export interface TransmissionResult {
  transmissionId: string;
  status: 'accepted' | 'rejected';
  timestamp: Date;
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Tracked status of a transmission.
 */
export interface TransmissionStatus {
  transmissionId: string;
  status: 'pending' | 'transmitted' | 'delivered' | 'failed';
  deliveredAt?: Date;
  failureReason?: string;
}

/**
 * Payload for an inbound invoice received from the Peppol network.
 */
export interface InboundInvoicePayload {
  documentId: string;
  senderParticipantId: string;
  receiverParticipantId: string;
  xml: string;
  receivedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Result of verifying a webhook signature.
 */
export interface WebhookVerification {
  valid: boolean;
  organizationId?: string;
  eventType?: string;
  connectionId?: string;
}

/**
 * Health status of the ASP connection.
 */
export interface ASPHealthStatus {
  healthy: boolean;
  latencyMs: number;
  lastCheckedAt: Date;
  error?: string;
}

/**
 * Abstract ASP adapter interface.
 * Vendor-agnostic so the specific provider can be swapped without changing callers.
 */
export interface ASPAdapter {
  readonly providerId: string;
  readonly displayName: string;

  /** Register a participant on the Peppol network */
  registerParticipant(params: RegisterParticipantParams): Promise<ParticipantRegistration>;

  /** Get current status of a registered participant */
  getParticipantStatus(participantId: string): Promise<ParticipantStatus>;

  /** Transmit an invoice to a receiver via the Peppol network */
  transmitInvoice(params: TransmitInvoiceParams): Promise<TransmissionResult>;

  /**
   * Probe the Peppol SML / SMP for a given participant's registered
   * document-type capabilities. Used by the capability cache + pre-flight
   * send gate to avoid hitting /invoices/submit against a participant that
   * won't accept the XRechnung-CII doc type.
   */
  lookupParticipantCapabilities(
    params: LookupParticipantCapabilitiesParams,
  ): Promise<ParticipantCapabilityResult>;

  /** Get current transmission status */
  getTransmissionStatus(transmissionId: string): Promise<TransmissionStatus>;

  /** Parse a webhook payload from the ASP */
  parseWebhookPayload(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<InboundInvoicePayload>;

  /** Verify webhook signature authenticity */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): WebhookVerification;

  /** Poll for inbound invoices since a given timestamp */
  pollInboundInvoices(since: Date): Promise<InboundInvoicePayload[]>;

  /** Check ASP API health */
  checkHealth(): Promise<ASPHealthStatus>;
}
