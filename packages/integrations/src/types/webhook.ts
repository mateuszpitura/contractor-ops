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
  /**
   * Reason a verification failed. Helps operators distinguish a configuration
   * problem (`config` — secret/API key missing or malformed) from genuine
   * signature mismatches (`signature` — likely an attacker probe or stale
   * webhook). Only set when `valid === false`.
   */
  reason?: 'config' | 'signature' | 'headers';
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
