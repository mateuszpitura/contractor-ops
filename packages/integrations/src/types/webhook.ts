/**
 * Result of verifying a webhook signature from a provider.
 */
export interface WebhookVerificationResult {
  valid: boolean;
  /** Resolved organization primary key (cuid) when known at verification time */
  organizationId?: string;
  /**
   * Organization slug (e.g. from inbound email domain) — resolve to `organizationId`
   * in the HTTP route before persisting WebhookDelivery (FK).
   */
  organizationSlug?: string;
  eventType?: string;
  connectionId?: string;
}

/**
 * Raw webhook delivery payload before processing.
 */
export interface WebhookPayload {
  deliveryId: string;
  provider: string;
  rawBody: string;
  headers: Record<string, string>;
}
