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
  status: "pending" | "registered" | "failed";
  registeredAt?: Date;
}

/**
 * Current status of a registered participant.
 */
export interface ParticipantStatus {
  participantId: string;
  status: "pending" | "registered" | "active" | "suspended" | "deregistered";
}

/**
 * Parameters for transmitting an invoice via the ASP.
 */
export interface TransmitInvoiceParams {
  xml: string;
  senderParticipantId: string;
  receiverParticipantId: string;
  documentTypeId: string;
  /** Organization ID for rate limiting and audit logging (optional). */
  organizationId?: string;
}

/**
 * Result of transmitting an invoice.
 */
export interface TransmissionResult {
  transmissionId: string;
  status: "accepted" | "rejected";
  timestamp: Date;
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Tracked status of a transmission.
 */
export interface TransmissionStatus {
  transmissionId: string;
  status: "pending" | "transmitted" | "delivered" | "failed";
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
 * Per D-01: vendor-agnostic so the specific provider can be swapped.
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
